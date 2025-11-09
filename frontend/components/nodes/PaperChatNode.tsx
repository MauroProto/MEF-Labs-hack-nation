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

      // Create placeholder assistant message for streaming
      const assistantMessageId = `msg-${Date.now()}-ai`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
            paperContext: connectedPaper,
          }),
        });

        if (!response.ok || !response.body) throw new Error('Chat API unavailable');

        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;

          // Update the assistant message with accumulated content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulatedContent }
                : msg
            )
          );
        }

        // Save final messages
        data.messages = [...messages, userMessage, { ...assistantMessage, content: accumulatedContent }];
      } catch (error) {
        console.warn('Falling back to client-side response.', error);
        const snippet = (connectedPaper.abstract || connectedPaper.fullText || '').slice(0, 1500);
        const fallbackContent = snippet
          ? `**Question:** ${userMessage.content}\n\n**Paper Context:** ${connectedPaper.title}\n\n**Relevant Text:**\n${snippet}${
              snippet.length === 1500 ? '...' : ''
            }\n\n---\n\n**Note:** Add your OpenAI API key to \`.env.local\` to enable AI-powered responses.\n\nFor now, here's the relevant context from the paper. The PDF text has been successfully extracted and is available for AI analysis once you configure your API key.`
          : `**No text extracted yet.**\n\nThe PDF content could not be extracted. Try:\n1. Re-uploading the PDF\n2. Using manual text entry\n3. Checking the PDF format\n\nOr add your OpenAI API key to enable AI-powered analysis.`;

        // Update assistant message with fallback
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fallbackContent }
              : msg
          )
        );
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
            <FileText className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-blue-900 truncate">{connectedPaper.title}</div>
              {connectedPaper.authors && connectedPaper.authors.length > 0 && (
                <div className="text-xs text-blue-600 truncate mt-0.5">
                  {connectedPaper.authors.map(a => a.name).join(', ')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 bg-amber-50 rounded-t border-b border-amber-200 flex-shrink-0">
            <div className="text-sm text-amber-900 font-medium">No paper connected</div>
            <div className="text-xs text-amber-700 mt-0.5">Connect a paper node to enable chat</div>
          </div>
        )}

        {/* Chat Messages Area - Flexible height */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <MessageCircle className="h-10 w-10 mb-3" />
              <p className="text-sm text-center px-4">
                {connectedPaper
                  ? 'Ask questions about this paper'
                  : 'Connect a paper to start chatting'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div key={message.id} className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-semibold text-base ${
                      message.role === 'user' ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {message.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                    <span className="text-sm text-gray-400">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`text-base leading-relaxed ${
                    message.role === 'user' ? 'text-gray-700' : 'text-gray-900'
                  }`}>
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
                            li: ({ children }) => <li>{children}</li>,
                            code: ({ children }) => (
                              <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono text-gray-800">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto mb-3 font-mono">
                                {children}
                              </pre>
                            ),
                            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{message.content}</div>
                    )}
                  </div>
                  {message.role === 'assistant' && index < messages.length - 1 && (
                    <div className="border-b border-gray-200 pt-3" />
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area - Fixed at bottom */}
        <form
          onSubmit={handleSendMessage}
          className="flex-shrink-0 flex items-center gap-3 p-4 bg-white border-t border-gray-200 rounded-b"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connectedPaper ? 'Ask a question…' : 'Connect a paper first'}
            disabled={loading || !connectedPaper}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || !connectedPaper}
            className="p-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
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
