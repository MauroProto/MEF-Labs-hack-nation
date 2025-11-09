/**
 * PDF Viewer Component
 *
 * Custom PDF viewer with text selection support
 * Maintains all existing functionality (nopan, scroll, etc.)
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { MessageSquare } from 'lucide-react';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure PDF.js worker (match installed version)
if (typeof window !== 'undefined') {
  const ver = (pdfjs as any)?.version || '4.8.69';
  (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
}

interface PDFViewerProps {
  fileUrl: string;
  onAskAboutSelection?: (selectedText: string) => void;
}

export function PDFViewer({ fileUrl, onAskAboutSelection }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [selectedText, setSelectedText] = useState<string>('');
  const selectedTextRef = useRef<string>('');
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectionRectRef = useRef<DOMRect | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  // Utility to clamp a point inside the container bounds with padding
  const clampToContainer = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const minX = pad;
    const minY = pad;
    const maxX = rect.width - pad;
    const maxY = rect.height - pad;
    return { x: Math.max(minX, Math.min(maxX, x)), y: Math.max(minY, Math.min(maxY, y)) };
  }, []);

  // Check for text selection with a small delay
  const updateButtonFromSelection = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (!text || text.length < 1) {
      setSelectedText('');
      selectedTextRef.current = '';
      setButtonPosition(null);
      lastSelectionRectRef.current = null;
      return;
    }

    try {
      const range = sel!.getRangeAt(0);
      let rect = range.getBoundingClientRect();
      // Prefer the first segment of the selection for placement (start of selection)
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        const rectList = range.getClientRects();
        if (rectList && rectList.length > 0) {
          // Use first non-zero rect if possible
          const first = Array.from(rectList).find(r => r.width > 0 && r.height > 0) || rectList[0]!;
          rect = first;
        }
      }
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!rect || !containerRect) return;

      lastSelectionRectRef.current = rect;

      // Position near selection top-right within container (stable & consistent)
      const relX = rect.right - containerRect.left - 6; // slight padding
      const relY = rect.top - containerRect.top - 28;   // above selection
      const clamped = clampToContainer(relX, relY);
      setSelectedText(text);
      selectedTextRef.current = text;
      setButtonPosition(clamped);
    } catch {
      // ignore
    }
  }, [clampToContainer]);

  const checkSelection = useCallback(() => {
    if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    // Slightly longer delay so we don't fight with text dragging
    selectionTimerRef.current = setTimeout(updateButtonFromSelection, 120);
  }, [updateButtonFromSelection]);

  // Mark selecting on mouse/pointer down so we don't reposition the button mid-drag
  const handleMouseDown = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const handleAskAboutSelection = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const text = selectedTextRef.current || selectedText || window.getSelection()?.toString() || '';
    console.log('Ask AI clicked with text:', text);

    if (text && onAskAboutSelection) {
      onAskAboutSelection(text);
      setSelectedText('');
      selectedTextRef.current = '';
      setButtonPosition(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [selectedText, onAskAboutSelection]);

  // Listen for selection changes (avoid heavy updates while dragging)
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      const anchor = sel?.anchorNode as Node | null;
      if (anchor && containerRef.current?.contains(anchor.nodeType === 1 ? (anchor as any) : anchor.parentElement)) {
        if (!isSelecting) {
          checkSelection();
        }
      } else {
        setSelectedText('');
        selectedTextRef.current = '';
        setButtonPosition(null);
        lastSelectionRectRef.current = null;
      }
    };

    const handleScrollOrResize = () => {
      // Recompute from current selection rect (fresh each time for accuracy)
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      try {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!rect || !containerRect) return;
        lastSelectionRectRef.current = rect;
        const relX = rect.right - containerRect.left - 6;
        const relY = rect.top - containerRect.top - 28;
        const clamped = clampToContainer(relX, relY);
        setButtonPosition(clamped);
      } catch {}
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('resize', handleScrollOrResize);
    containerRef.current?.addEventListener('scroll', handleScrollOrResize, { passive: true });

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('resize', handleScrollOrResize);
      containerRef.current?.removeEventListener('scroll', handleScrollOrResize as any);
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, [checkSelection, clampToContainer, isSelecting]);

  // Update button position after mouse up
  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
    setTimeout(updateButtonFromSelection, 50);
  }, [updateButtonFromSelection]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full nopan relative overflow-auto"
      style={{
        userSelect: 'text',
        WebkitUserSelect: 'text',
        pointerEvents: 'auto',
        cursor: 'text'
      }}
      onWheel={(e) => e.stopPropagation()}
      onMouseUp={handleMouseUp}
      onMouseDown={(e) => {
        // Stop bubbling so React Flow doesn't intercept and prevent selection
        e.stopPropagation();
        handleMouseDown();
      }}
      onPointerDown={(e) => {
        // Ensure touch/stylus also avoid React Flow handlers
        e.stopPropagation();
        handleMouseDown();
      }}
    >
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        }
        error={
          <div className="flex items-center justify-center h-full text-red-500">
            Failed to load PDF
          </div>
        }
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            renderTextLayer={true}
            renderAnnotationLayer={false}
            className="mb-4"
            width={containerRef.current?.clientWidth ? containerRef.current.clientWidth - 40 : undefined}
            canvasBackground="white"
          />
        ))}
      </Document>

      {/* Floating "Ask AI" button when text is selected */}
      {selectedText && buttonPosition && !isSelecting && (
        <div
          className="absolute z-[9999] pointer-events-none"
          style={{ left: `${buttonPosition.x}px`, top: `${buttonPosition.y}px` }}
        >
          <button
            onClick={handleAskAboutSelection}
            onMouseDown={(e) => e.stopPropagation()}
            className="pointer-events-auto bg-neutral-900 text-white rounded-full px-3 py-1.5 shadow-md hover:bg-neutral-800 transition-all flex items-center gap-2 text-[12px] font-medium whitespace-nowrap"
          >
            <MessageSquare className="h-4 w-4" />
            Ask AI about this
          </button>
        </div>
      )}
    </div>
  );
}
