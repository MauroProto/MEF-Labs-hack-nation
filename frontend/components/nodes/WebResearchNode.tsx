/**
 * Web Research Node - Minimalist Edition
 *
 * Uses OpenAI's o4-mini-deep-research model with streaming
 */

'use client';

import React, { useState, useCallback, useRef, useMemo, useEffect, memo } from 'react';
import { BaseNode } from './BaseNode';
import { Search, Square, Loader2, Link2 } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import { useChatContextStore } from '@/lib/stores/chatContextStore';
import { useStore } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface WebResearchNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

type ResearchStatus = 'idle' | 'working' | 'completed' | 'error';

function WebResearchNodeComponent({ id, data, selected }: WebResearchNodeProps) {
  const [status, setStatus] = useState<ResearchStatus>((data.status as ResearchStatus) || 'idle');
  const [query, setQuery] = useState<string>(data.query || '');
  const [output, setOutput] = useState<string>(data.output || '');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [activities, setActivities] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Optimized Zustand selectors - separate calls to avoid infinite loop
  const getPaper = usePaperContextStore((s) => s.getPaper);
  const updateConversation = useChatContextStore((s) => s.updateConversation);
  const getUpstreamChats = useChatContextStore((s) => s.getUpstreamChats);
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);

  // Detect connected paper like the Chat node does (incoming edge from paper-upload with lastPaperId)
  const connectedPaper = useMemo(() => {
    const incoming = edges.filter((e) => e.target === id);
    for (const e of incoming) {
      const src = nodes.find((n) => n.id === e.source);
      const lastId = (src?.data as any)?.lastPaperId as string | undefined;
      if (lastId) {
        const p = getPaper(lastId);
        if (p) return p;
      }
    }
    return null;
  }, [edges, nodes, id, getPaper]);

  // Get upstream chats for context
  const upstreamChats = getUpstreamChats(id);

  // Debounced update to conversation store - reduces unnecessary updates
  useEffect(() => {
    if (!output || !query) return;

    const timeoutId = setTimeout(() => {
      const messages = [
        {
          id: `research-query-${Date.now()}`,
          role: 'user' as const,
          content: query,
          timestamp: new Date(),
        },
        {
          id: `research-result-${Date.now()}`,
          role: 'assistant' as const,
          content: output,
          timestamp: new Date(),
        },
      ];
      updateConversation(
        id,
        messages,
        connectedPaper ? { paperId: connectedPaper.id, title: connectedPaper.title } : undefined
      );
    }, 500); // Debounce by 500ms

    return () => clearTimeout(timeoutId);
  }, [output, query, id, connectedPaper, updateConversation]);

  const handleResearch = useCallback(async () => {
    if (!query.trim()) return;

    setStatus('working');
    setOutput('');
    setActivities([]);
    setProgressMessage('🔍 Connecting to research model...');
    data.status = 'working';

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/research/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          // Send context inline; server will cap length
          paperContext: connectedPaper
            ? {
                id: connectedPaper.id,
                title: connectedPaper.title,
                abstract: connectedPaper.abstract,
                fullText: connectedPaper.fullText,
                metadata: connectedPaper.metadata,
              }
            : null,
          chatContext: upstreamChats,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Research request failed');
      }

      setProgressMessage(
        connectedPaper
          ? `🌐 Researching around: ${connectedPaper.title}`
          : '🌐 Starting web search...'
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      let accumulated = '';
      let hasReceivedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);

              // Handle activity updates (searches, page opens, etc.)
              if (parsed.type === 'activity') {
                setActivities(prev => [...prev, parsed.message]);
                setProgressMessage(parsed.message);
              }
              // Handle content (actual research output)
              else if (parsed.type === 'content' && parsed.content) {
                if (!hasReceivedContent) {
                  setProgressMessage('✍️ Generando respuesta...');
                  hasReceivedContent = true;
                }
                accumulated += parsed.content;
                setOutput(accumulated);
                data.output = accumulated;
              }
              // Legacy support for old format
              else if (parsed.content) {
                if (!hasReceivedContent) {
                  setProgressMessage('✍️ Generando respuesta...');
                  hasReceivedContent = true;
                }
                accumulated += parsed.content;
                setOutput(accumulated);
                data.output = accumulated;
              }
            } catch (e) {
              console.error('Failed to parse chunk:', e, dataStr);
            }
          }
        }
      }

      setStatus('completed');
      setProgressMessage('');
      data.status = 'completed';
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setStatus('error');
        data.status = 'error';
        setOutput('Research failed. Please try again.');
        setProgressMessage('');
        console.error('Web research error:', error);
      } else {
        setProgressMessage('');
      }
    }
  }, [query, data, connectedPaper, upstreamChats]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setProgressMessage('');
    data.status = 'idle';
  }, [data]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="flex flex-col h-full">
        {/* Header minimal: status + paper chip + upstream chats indicator */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={connectedPaper || upstreamChats.length > 0 ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'h-1.5 w-1.5 rounded-full bg-amber-500'}
            />
            {connectedPaper ? (
              <div className="truncate max-w-[180px] rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700">
                <span className="font-medium text-gray-900">Paper:</span> {connectedPaper.title}
              </div>
            ) : (
              <div className="text-[11px] text-gray-500">General web search</div>
            )}
            {upstreamChats.length > 0 && (
              <div className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                <Link2 className="h-2.5 w-2.5" />
                <span>{upstreamChats.length} chat{upstreamChats.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            {status === 'working' && <span>{progressMessage || 'Researching…'}</span>}
          </div>
        </div>

        {/* Output / Streaming */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 bg-white">
          {output ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  code: ({ children }) => (
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-[12px] font-mono text-gray-900">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-gray-100 p-2 rounded text-[12px] overflow-x-auto mb-2 font-mono">{children}</pre>
                  ),
                }}
              >
                {output}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center">
              {status === 'working' ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-green-500" />
                  <p className="mt-2 text-gray-500">{progressMessage || 'Researching…'}</p>
                </>
              ) : (
                <p className="text-gray-500">
                  {connectedPaper
                    ? 'Enter a query to research around the paper'
                    : upstreamChats.length > 0
                    ? 'Research based on previous conversations'
                    : 'Perform a deep web search'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Input minimal (pill) + Stop */}
        <div className="px-3 py-2 bg-white border-t border-gray-100">
          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 flex-1 rounded-full border border-gray-200 bg-white px-3 py-1.5">
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  data.query = e.target.value;
                }}
                placeholder={connectedPaper || upstreamChats.length > 0 ? 'Type your search…' : 'Type your web search…'}
                disabled={status === 'working'}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
              />
              {status !== 'working' && (
                <button
                  onClick={handleResearch}
                  disabled={!query.trim()}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white disabled:bg-gray-300"
                  title="Research"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {status === 'working' && (
              <button
                onClick={handleStop}
                className="inline-flex h-7 px-3 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </BaseNode>
  );
}

// Export memoized version to prevent unnecessary re-renders
export const WebResearchNode = memo(WebResearchNodeComponent);
