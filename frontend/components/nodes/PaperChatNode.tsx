/**
 * Paper Chat Node - Minimalist gray design
 * FIXED: Detects connected papers via React Flow edges
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { Send, Loader2 } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import { useStore } from '@xyflow/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PaperChatNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function PaperChatNode({ id, data, selected }: PaperChatNodeProps) {
  const [messages, setMessages] = useState<Message[]>(data.messages || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // FIX: Use React Flow to detect connected papers - use useStore for reactive edges
  const { getPaper } = usePaperContextStore();

  // Listen to edges changes reactively - this makes the component re-render when connections change
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);

  // Buscar paper conectado a través de edges entrantes
  // Re-ejecutar cada vez que cambian edges o nodes
  const connectedPaper = React.useMemo(() => {
    const incomingEdges = edges.filter(edge => edge.target === id);

    console.log('[PaperChatNode] Checking connections...', {
      totalEdges: edges.length,
      totalNodes: nodes.length,
      incomingEdges: incomingEdges.length,
      chatNodeId: id
    });

    for (const edge of incomingEdges) {
      console.log('[PaperChatNode] Edge:', edge.source, '→', edge.target);
      const sourceNode = nodes.find(n => n.id === edge.source);
      console.log('[PaperChatNode] Source node:', {
        id: sourceNode?.id,
        type: sourceNode?.type,
        hasLastPaperId: !!sourceNode?.data?.lastPaperId,
        lastPaperId: sourceNode?.data?.lastPaperId
      });

      if (sourceNode?.data?.lastPaperId) {
        const paper = getPaper(sourceNode.data.lastPaperId);
        if (paper) {
          console.log('[PaperChatNode] ✅ Found connected paper:', paper.title, 'textLength:', paper.fullText?.length);
          return paper;
        } else {
          console.warn('[PaperChatNode] ⚠️ Paper ID found but not in store:', sourceNode.data.lastPaperId);
        }
      }
    }

    console.log('[PaperChatNode] ⚠️ No paper connected');
    return null;
  }, [edges, nodes, getPaper, id]); // React to edges and nodes changes

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || loading) return;

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);

      // DEBUG: Log what we're sending
      console.log('[PaperChatNode] Sending message to API:', {
        hasConnectedPaper: !!connectedPaper,
        paperTitle: connectedPaper?.title,
        fullTextLength: connectedPaper?.fullText?.length,
        fullTextPreview: connectedPaper?.fullText?.substring(0, 100)
      });

      try {
        const requestBody = {
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
          paperContext: connectedPaper ? {
            id: connectedPaper.id,
            title: connectedPaper.title,
            authors: connectedPaper.authors,
            abstract: connectedPaper.abstract,
            fullText: connectedPaper.fullText,
            citations: connectedPaper.citations,
            metadata: connectedPaper.metadata
          } : null,
        };

        console.log('[PaperChatNode] Request body:', {
          messageCount: requestBody.messages.length,
          hasPaperContext: !!requestBody.paperContext,
          paperContextTextLength: requestBody.paperContext?.fullText?.length
        });

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('[PaperChatNode] API error:', errorData);
          throw new Error('Chat API unavailable');
        }

        const result = await response.json();
        console.log('[PaperChatNode] ✅ Received response from API');

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        data.messages = [...messages, userMessage, assistantMessage];
      } catch (error) {
        console.error('[PaperChatNode] ❌ Chat error:', error);
        const snippet = connectedPaper ? (connectedPaper.abstract || connectedPaper.fullText || '').slice(0, 600) : '';
        const fallbackContent = snippet
          ? `Q: ${userMessage.content}\n\nContext: ${snippet}${snippet.length === 600 ? '...' : ''}`
          : `No paper context available.`;

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-fallback`,
          role: 'assistant',
          content: fallbackContent,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, connectedPaper, data]
  );

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="flex flex-col h-full">
        {/* Messages area - ARRIBA (top), grows to fill space */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 min-h-0">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center">
              {connectedPaper ? (
                <>
                  <div className="text-gray-600 font-medium mb-1">📄 {connectedPaper.title}</div>
                  <div>Ask questions about this paper</div>
                </>
              ) : (
                'Connect a paper upload node to start'
              )}
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`px-3 py-2 rounded text-xs max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        code: ({ children }) => (
                          <code className="bg-gray-100 px-1 rounded text-[11px]">{children}</code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-gray-100 p-2 rounded text-[11px] overflow-x-auto mb-2">{children}</pre>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area - ABAJO (bottom), stays fixed at bottom */}
        <form
          onSubmit={handleSendMessage}
          className="flex items-center gap-2 p-2 bg-white border-t border-gray-200 flex-shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-gray-400 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-gray-800 text-white rounded hover:bg-gray-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </BaseNode>
  );
}
