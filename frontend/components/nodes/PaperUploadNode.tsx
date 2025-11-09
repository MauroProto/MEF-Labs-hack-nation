/**
 * Paper Upload Node - Simplified UI
 *
 * Simple PDF upload with large viewer.
 * - Click to upload PDF
 * - Shows PDF in large viewer when loaded
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { Upload, Loader2 } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import dynamic from 'next/dynamic';
import { useReactFlow } from '@xyflow/react';
import { NODE_CONFIGS } from '@/lib/nodeTypes';

interface PaperUploadNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function PaperUploadNode({ id, data, selected }: PaperUploadNodeProps) {
  const [loading, setLoading] = useState(false);
  const creatingRef = React.useRef(false);

  const { addPaper, getPaper, connectNodeToPaper, getPaperForNode } = usePaperContextStore();
  const { setNodes, setEdges, getNode } = useReactFlow();

  const lastPaper = useMemo(() => {
    const pid = data?.lastPaperId as string | undefined;
    return pid ? getPaper(pid) : undefined;
  }, [data?.lastPaperId, getPaper]);

  // Lazy-load PDF viewer to reduce bundle size
  const PDFViewer = useMemo(
    () =>
      dynamic(() => import('./PDFViewer').then((m) => m.PDFViewer), {
        ssr: false,
        loading: () => (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
          </div>
        ),
      }),
    []
  );

  const handleAskAboutSelection = useCallback((selectedText: string) => {
    if (creatingRef.current) return; // debounce rapid clicks
    creatingRef.current = true;
    setTimeout(() => (creatingRef.current = false), 400);

    const currentNode = getNode(id);
    const ctxPaper = getPaperForNode(id) || lastPaper;
    if (!currentNode || !ctxPaper) return;

    // Create new chat node to the right of the PDF node
    const uid = (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*1e6)}`;
    const newChatNodeId = `paper-chat-${uid}`;
    const chatConfig = NODE_CONFIGS['paper-chat'];

    const newChatNode = {
      id: newChatNodeId,
      type: 'paper-chat',
      position: {
        x: currentNode.position.x + (currentNode.width || chatConfig.defaultWidth) + 50,
        y: currentNode.position.y,
      },
      data: {
        label: 'Paper Chat',
        config: chatConfig,
        initialMessage: `About this excerpt: "${selectedText}"`,
        lastPaperId: ctxPaper.id,
      },
      width: chatConfig.defaultWidth,
      height: chatConfig.defaultHeight,
    };

    // Create edge connecting PDF node to chat node
    const newEdge = {
      id: `e${id}-${newChatNodeId}`,
      source: id,
      target: newChatNodeId,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: '#64748b',
        strokeWidth: 3,
      },
    };

    // Add the new node and edge
    setNodes((nds) => [...nds, newChatNode]);
    setEdges((eds) => [...eds, newEdge]);

    // Immediately bind chat node to the same paper for deterministic context
    connectNodeToPaper(newChatNodeId, ctxPaper.id);
  }, [id, lastPaper, getNode, setNodes, setEdges, connectNodeToPaper, getPaperForNode]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // Create local URL for preview
      const objectUrl = URL.createObjectURL(file);

      // Brief processing for user feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Extract text if PDF (client-side) for chat context
      let extractedText = '';
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjs: any = await import('pdfjs-dist');
          // Configure worker from CDN
          if (pdfjs.GlobalWorkerOptions) {
            const ver = (pdfjs as any)?.version || '4.8.69';
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
          }
          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const maxPages = Math.min(pdf.numPages, 60); // Limit for performance
          for (let p = 1; p <= maxPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const text = content.items
              .map((it: any) => ('str' in it ? it.str : ''))
              .join(' ');
            extractedText += text + '\n';
          }
          // Sanitize text: remove null bytes and invalid UTF-8 characters for PostgreSQL
          extractedText = extractedText
            .replace(/\0/g, '') // Remove null bytes
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
            .trim();
        } catch (err) {
          console.warn('PDF text extraction failed, using placeholder.', err);
        }
      }

      // Get or create default canvas
      let canvasId = 'default';
      try {
        const canvasResponse = await fetch('http://localhost:4000/api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Default Canvas' }),
        });
        if (canvasResponse.ok) {
          const canvasData = await canvasResponse.json();
          canvasId = canvasData.data?.id || 'default';
        }
      } catch (err) {
        console.warn('Failed to create/get canvas, using default', err);
      }

      // Save paper to database
      const backendPaperData = {
        canvasId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        authors: ['Unknown Author'],
        abstract: null,
        fullText: extractedText || 'Uploaded PDF (preview available).',
        citations: [],
        metadata: {
          uploadedAt: new Date().toISOString(),
          fileUrl: objectUrl,
          filename: file.name,
        },
      };

      let savedPaper;
      try {
        const paperResponse = await fetch('http://localhost:4000/api/papers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendPaperData),
        });

        if (!paperResponse.ok) {
          const errorData = await paperResponse.json().catch(() => null);
          throw new Error(errorData?.error || `HTTP ${paperResponse.status}`);
        }

        const result = await paperResponse.json();
        savedPaper = result.data;
      } catch (err) {
        console.error('Failed to save paper to backend:', err);
        // Fallback to in-memory only if database fails
        const paperData = {
          id: `paper-${Date.now()}`,
          canvasId: 'default',
          title: file.name.replace(/\.[^/.]+$/, ''),
          authors: [{ name: 'Unknown Author' }],
          abstract: null,
          fullText: extractedText || 'Uploaded PDF (preview available).',
          citations: [],
          metadata: {
            uploadedAt: new Date(),
            fileUrl: objectUrl,
            filename: file.name,
          },
        };
        addPaper(paperData);
        connectNodeToPaper(id, paperData.id);
        data.lastPaperId = paperData.id;
        return;
      }

      // Create frontend paper object with backend ID
      const paperData = {
        id: savedPaper.id,
        canvasId: savedPaper.canvasId,
        title: savedPaper.title,
        authors: savedPaper.authors.map((name: string) => ({ name })),
        abstract: savedPaper.abstract,
        fullText: savedPaper.fullText,
        citations: savedPaper.citations || [],
        metadata: {
          ...savedPaper.metadata,
          uploadedAt: new Date(savedPaper.createdAt),
          fileUrl: objectUrl,
          filename: file.name,
        },
      };

      addPaper(paperData);
      connectNodeToPaper(id, paperData.id);
      data.lastPaperId = paperData.id;
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  }, [addPaper, connectNodeToPaper, id, data]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      {/* No PDF loaded: show upload area */}
      {!lastPaper?.metadata?.fileUrl ? (
        <div className="w-full h-full flex items-center justify-center">
          <input
            type="file"
            id={`file-upload-${id}`}
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
            disabled={loading}
          />
          <label htmlFor={`file-upload-${id}`} className="cursor-pointer flex flex-col items-center gap-3">
            {loading ? (
              <>
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                <span className="text-base text-gray-600">Loading PDF...</span>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-gray-400" />
                <div className="space-y-1">
                  <p className="text-base font-medium text-gray-700">Upload PDF</p>
                  <p className="text-sm text-gray-500">Click to select a PDF file</p>
                </div>
              </>
            )}
          </label>
        </div>
      ) : (
        /* PDF loaded: show viewer with text selection */
        <PDFViewer
          fileUrl={lastPaper.metadata.fileUrl}
          onAskAboutSelection={handleAskAboutSelection}
        />
      )}
    </BaseNode>
  );
}
