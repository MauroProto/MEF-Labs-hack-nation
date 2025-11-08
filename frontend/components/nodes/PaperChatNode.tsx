/**
 * Paper Chat Node
 *
 * Context-aware AI chat that automatically detects connected papers.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { Send, FileText, MessageCircle, Loader2 } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
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

  const getPaperForNode = usePaperContextStore(state => state.getPaperForNode);
  const connectedPaper = getPaperForNode(id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || loading || !connectedPaper) return;

      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
            paperContext: connectedPaper,
          }),
        });

        if (!response.ok) throw new Error('Chat API unavailable');

        const result = await response.json();
        const assistantMessage: Message = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: result.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        data.messages = [...messages, userMessage, assistantMessage];
      } catch (error) {
        console.warn('Falling back to client-side response.', error);
        const snippet = (connectedPaper.abstract || connectedPaper.fullText || '').slice(0, 600);
        const fallbackContent = snippet
          ? `Q: ${userMessage.content}\n\nContext (${connectedPaper.title}):\n${snippet}${
              snippet.length === 600 ? '...' : ''
            }\n\nRespuesta (local): esta es una vista previa generada con el contenido disponible.`
          : `No pude extraer texto del PDF todavía. Intenta volver a cargarlo o añade texto manual.`;

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
      <div className="space-y-1.5">
        {/* Paper selector */}
        <div className="space-y-1">
          {papersList.length > 0 && (
            <select
              value={selectedPaperId || ''}
              onChange={(event) => {
                const value = event.target.value || null;
                setSelectedPaperId(value);
                data.paperId = value;
              }}
              className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">-- Select paper --</option>
              {papersList.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title}
                </option>
              ))}
            </select>
          )}

          {connectedPaper ? (
            <div className="p-1.5 bg-blue-50 rounded text-[10px] border border-blue-100 flex items-start gap-1.5">
              <FileText className="h-2.5 w-2.5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="truncate text-blue-900">{connectedPaper.title}</div>
            </div>
          ) : (
            <div className="p-1.5 bg-amber-50 rounded text-[10px] border border-amber-100 text-amber-900">
              Conecta o selecciona un paper para darle contexto al chat.
            </div>
          )}
        </div>

        {/* Chat window */}
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="h-48 overflow-y-auto p-1.5 space-y-1.5 bg-gray-50" style={{ maxHeight: '192px' }}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <MessageCircle className="h-5 w-5 mb-1" />
                <p className="text-[10px] text-center">
                  Haz una pregunta sobre el paper conectado o selecciona uno manualmente.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-2 py-1 rounded text-[10px] whitespace-pre-wrap ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white max-w-[240px]'
                        : 'bg-white text-gray-900 border border-gray-200 max-w-[280px]'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-xs max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="mb-1 ml-3 list-disc">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-1 ml-3 list-decimal">{children}</ol>,
                            li: ({ children }) => <li className="mb-0.5">{children}</li>,
                            code: ({ children }) => (
                              <code className="bg-gray-100 px-1 rounded text-[9px]">{children}</code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-gray-100 p-1 rounded text-[9px] overflow-x-auto mb-1">{children}</pre>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-1.5 p-1.5 bg-white border-t border-gray-200"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={connectedPaper ? 'Ask a question…' : 'Attach a paper first'}
              disabled={loading || !connectedPaper}
              className="flex-1 px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || !connectedPaper}
              className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>

        {messages.length > 0 && (
          <div className="text-[10px] text-gray-400 text-right">{messages.length} mensajes</div>
        )}
      </div>
    </BaseNode>
  );
}
