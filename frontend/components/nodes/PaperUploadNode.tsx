/**
 * Paper Upload Node
 *
 * Allows users to upload research papers to the canvas.
 * Features:
 * - File upload (PDF, TXT)
 * - Manual paper entry
 * - Paper metadata input
 * - Backend integration
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { Upload, FileText, Check, Loader2, Maximize2, X } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';

interface PaperUploadNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function PaperUploadNode({ id, data, selected }: PaperUploadNodeProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'manual'>('file');
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Manual entry state
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [abstract, setAbstract] = useState('');
  const [fullText, setFullText] = useState('');

  const { addPaper, getPaper, connectNodeToPaper } = usePaperContextStore();

  const lastPaper = useMemo(() => {
    const pid = data?.lastPaperId as string | undefined;
    return pid ? getPaper(pid) : undefined;
  }, [data?.lastPaperId, getPaper]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      // Crear URL local para previsualización
      const objectUrl = URL.createObjectURL(file);

      // Simular procesamiento breve para feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Extraer texto si es PDF (cliente) para dar contexto al Chat
      let extractedText = '';
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfjs: any = await import('pdfjs-dist');
          // Worker desde CDN (alineado a lock actual)
          if (pdfjs.GlobalWorkerOptions) {
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
          }
          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const maxPages = Math.min(pdf.numPages, 12); // Limitar para rendimiento
          for (let p = 1; p <= maxPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const text = content.items
              .map((it: any) => ('str' in it ? it.str : ''))
              .join(' ');
            extractedText += text + '\n';
          }
          extractedText = extractedText.trim();
        } catch (err) {
          console.warn('PDF text extraction failed, using placeholder.', err);
        }
      }

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
      data.lastPaperId = paperData.id;
      setUploaded(true);
      setTimeout(() => setUploaded(false), 3000);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  }, [addPaper, connectNodeToPaper, id]);

  const handleManualSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fullText.trim()) return;

    setLoading(true);
    try {
      const paperData = {
        id: `paper-${Date.now()}`,
        canvasId: 'default',
        title: title.trim(),
        authors: authors.split(',').map(a => ({ name: a.trim() })).filter(a => a.name),
        abstract: abstract.trim() || null,
        fullText: fullText.trim(),
        citations: [],
        metadata: {
          year: year ? parseInt(year) : undefined,
          uploadedAt: new Date(),
        },
      };

      // TODO: Send to backend API
      await new Promise(resolve => setTimeout(resolve, 800));

      addPaper(paperData);
      connectNodeToPaper(id, paperData.id);
      data.lastPaperId = paperData.id;

      // Clear form
      setTitle('');
      setAuthors('');
      setYear('');
      setAbstract('');
      setFullText('');

      setUploaded(true);
      setTimeout(() => setUploaded(false), 3000);
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  }, [title, authors, year, abstract, fullText, addPaper, connectNodeToPaper, id]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-3">
        {/* Mode Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setUploadMode('file')}
            className={`flex-1 px-2 py-1 text-[11px] rounded transition-colors ${
              uploadMode === 'file' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            File
          </button>
          <button
            onClick={() => setUploadMode('manual')}
            className={`flex-1 px-2 py-1 text-[11px] rounded transition-colors ${
              uploadMode === 'manual' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Manual
          </button>
        </div>

        {/* File Upload Mode */}
        {uploadMode === 'file' && (
          <div className="border-2 border-dashed border-gray-300 rounded p-4 text-center bg-white">
            <input
              type="file"
              id={`file-upload-${id}`}
              accept=".pdf,.txt"
              onChange={handleFileUpload}
              className="hidden"
              disabled={loading}
            />
            <label htmlFor={`file-upload-${id}`} className="cursor-pointer flex flex-col items-center gap-1.5">
              {loading ? (
                <>
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                  <span className="text-[10px] text-gray-600">Uploading...</span>
                </>
              ) : uploaded ? (
                <>
                  <Check className="h-6 w-6 text-green-600" />
                  <span className="text-[10px] text-green-700">Done</span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="text-[10px] text-gray-600">Upload PDF/TXT</span>
                </>
              )}
            </label>
          </div>
        )}

        {/* Manual Entry Mode */}
        {uploadMode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <input
              type="text"
              placeholder="Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400"
              required
            />
            <input
              type="text"
              placeholder="Authors"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400"
            />
            <textarea
              placeholder="Text *"
              value={fullText}
              onChange={(e) => setFullText(e.target.value)}
              className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-gray-400 resize-none"
              rows={3}
              required
            />
            <button
              type="submit"
              disabled={loading || !title.trim() || !fullText.trim()}
              className="w-full px-2 py-1 text-[11px] bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Adding
                </>
              ) : uploaded ? (
                <>
                  <Check className="h-2.5 w-2.5" />
                  Added
                </>
              ) : (
                <>
                  <FileText className="h-2.5 w-2.5" />
                  Add
                </>
              )}
            </button>
          </form>
        )}

        {/* Inline preview (PDF) if available */}
        {lastPaper?.metadata?.fileUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="truncate text-gray-600">{lastPaper?.metadata?.filename || lastPaper?.title}</span>
              <button
                onClick={() => setViewerOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Maximize2 className="h-3 w-3" />
                Open
              </button>
            </div>
            <div className="rounded border border-gray-200 overflow-hidden bg-gray-50" style={{height: 160}}>
              <iframe
                src={lastPaper.metadata.fileUrl}
                title="PDF Preview"
                className="w-full h-full"
              />
            </div>
          </div>
        )}

        {/* Full-screen viewer (minimal) */}
        {viewerOpen && lastPaper?.metadata?.fileUrl && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="absolute inset-0 bg-black/30" onClick={() => setViewerOpen(false)} />
            <div className="relative z-10 flex-1 m-3 rounded-lg border border-gray-200 overflow-hidden bg-white">
              <div className="absolute top-2 right-2 z-20">
                <button
                  onClick={() => setViewerOpen(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <X className="h-4 w-4" /> Close
                </button>
              </div>
              <iframe src={lastPaper.metadata.fileUrl} className="w-full h-full" />
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
