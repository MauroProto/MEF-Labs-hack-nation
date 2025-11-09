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

interface PaperUploadNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function PaperUploadNode({ id, data, selected }: PaperUploadNodeProps) {
  const [loading, setLoading] = useState(false);

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
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  }, [addPaper, connectNodeToPaper, id, data]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      {/* Si no hay PDF cargado: mostrar área de carga */}
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
        /* Si hay PDF cargado: mostrar visor grande */
        <iframe
          src={lastPaper.metadata.fileUrl}
          title="PDF Viewer"
          className="w-full h-full block"
          style={{
            display: 'block',
            border: 'none',
            margin: 0,
            padding: 0,
            pointerEvents: (selected && !data.locked) ? 'none' : 'auto'
          }}
        />
      )}
    </BaseNode>
  );
}
