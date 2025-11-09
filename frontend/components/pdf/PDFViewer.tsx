"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";

// Configure worker with matching version to avoid mismatches
const ver = (pdfjs as any)?.version || "4.10.38";
if ((pdfjs as any).GlobalWorkerOptions) {
  (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
}

export interface PDFViewerProps {
  fileUrl: string;
  /** Height of the scrollable container */
  height?: number;
  /** Limit number of pages rendered (for inline previews) */
  maxPages?: number;
  /** Called when user clicks the floating Ask button */
  onAsk?: (text: string) => void;
}

export function PDFViewer({ fileUrl, height = 400, maxPages, onAsk }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [askPos, setAskPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");

  const pagesToRender = useMemo(() => {
    if (!numPages) return 0;
    return maxPages ? Math.min(numPages, maxPages) : numPages;
  }, [numPages, maxPages]);

  const handleLoadSuccess = useCallback((info: { numPages: number }) => {
    setNumPages(info.numPages);
    setLoading(false);
  }, []);

  // Selection tracking inside container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setAskPos(null);
        setSelectedText("");
        return;
      }
      const range = sel.getRangeAt(0);
      // Ensure selection belongs to our container
      const ancestor = range.commonAncestorContainer as HTMLElement | null;
      const belongs = ancestor && el.contains(ancestor.nodeType === 1 ? ancestor : (ancestor.parentElement as any));
      const text = sel.toString().trim();

      if (!belongs || !text) {
        setAskPos(null);
        setSelectedText("");
        return;
      }

      const rect = range.getBoundingClientRect();
      const crect = el.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        setAskPos(null);
        setSelectedText("");
        return;
      }

      // Position button near selection (top-right) within container
      const x = rect.right - crect.left - 8; // 8px pad
      const y = rect.top - crect.top - 32; // above selection
      setAskPos({ x, y: Math.max(8, y) });
      setSelectedText(text);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const handleAskClick = useCallback(() => {
    if (!selectedText) return;
    onAsk?.(selectedText);
    // Keep selection & button visible until user clicks elsewhere
  }, [selectedText, onAsk]);

  return (
    <div
      ref={containerRef}
      className="relative border border-gray-200 rounded overflow-auto bg-white"
      style={{ height }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      )}
      <Document file={fileUrl} onLoadSuccess={handleLoadSuccess} loading={null}>
        {Array.from({ length: pagesToRender }, (_, i) => (
          <Page
            key={`p_${i + 1}`}
            pageNumber={i + 1}
            renderTextLayer
            renderAnnotationLayer={false}
            width={containerRef.current ? containerRef.current.clientWidth - 20 : undefined}
          />
        ))}
      </Document>

      {askPos && selectedText && (
        <button
          onClick={handleAskClick}
          className="absolute z-10 inline-flex items-center gap-1 rounded-full bg-neutral-900 text-white px-2.5 py-1 text-[11px] shadow-md hover:bg-neutral-800"
          style={{ left: askPos.x, top: askPos.y }}
        >
          Ask AI about this
        </button>
      )}
    </div>
  );
}

