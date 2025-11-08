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

  const { getPaperForNode } = usePaperContextStore();
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
        const snippet = (connectedPaper.abstract || connectedPaper.fullText || '').slice(0, 1500);
        const fallbackContent = snippet
          ? `**Question:** ${userMessage.content}\n\n**Paper Context:** ${connectedPaper.title}\n\n**Relevant Text:**\n${snippet}${
              snippet.length === 1500 ? '...' : ''
            }\n\n---\n\n**Note:** Add your OpenAI API key to \`.env.local\` to enable AI-powered responses.\n\nFor now, here's the relevant context from the paper. The PDF text has been successfully extracted and is available for AI analysis once you configure your API key.`
          : `**No text extracted yet.**\n\nThe PDF content could not be extracted. Try:\n1. Re-uploading the PDF\n2. Using manual text entry\n3. Checking the PDF format\n\nOr add your OpenAI API key to enable AI-powered analysis.`;

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
      <div className="flex flex-col h-full w-full">
        {/* Connected Paper Indicator */}
        {connectedPaper ? (
          <div className="p-2 bg-blue-50 rounded-t border-b border-blue-100 flex items-start gap-2 flex-shrink-0">
            <FileText className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-blue-900 truncate">{connectedPaper.title}</div>
              {connectedPaper.authors && connectedPaper.authors.length > 0 && (
                <div className="text-[9px] text-blue-600 truncate mt-0.5">
                  {connectedPaper.authors.map(a => a.name).join(', ')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 bg-amber-50 rounded-t border-b border-amber-200 flex-shrink-0">
            <div className="text-[11px] text-amber-900 font-medium">No paper connected</div>
            <div className="text-[9px] text-amber-700 mt-0.5">Connect a paper node to enable chat</div>
          </div>
        )}

        {/* Chat Messages Area - Flexible height */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-gray-50">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <MessageCircle className="h-8 w-8 mb-2" />
              <p className="text-xs text-center px-4">
                {connectedPaper
                  ? 'Ask questions about this paper'
                  : 'Connect a paper to start chatting'}
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`px-3 py-2 rounded-lg text-xs max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-xs max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                            li: ({ children }) => <li>{children}</li>,
                            code: ({ children }) => (
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-gray-100 p-2 rounded text-[10px] overflow-x-auto mb-2 font-mono">
                                {children}
                              </pre>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area - Fixed at bottom */}
        <form
          onSubmit={handleSendMessage}
          className="flex-shrink-0 flex items-center gap-2 p-2 bg-white border-t border-gray-200 rounded-b"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connectedPaper ? 'Ask a question…' : 'Connect a paper first'}
            disabled={loading || !connectedPaper}
            className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !connectedPaper}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        {/* Message Counter */}
        {messages.length > 0 && (
          <div className="px-2 py-1 text-[9px] text-gray-400 text-center bg-gray-50 border-t border-gray-100">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
