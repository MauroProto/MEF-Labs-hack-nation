/**
 * Paper Chat Node
 *
 * Context-aware AI chat that automatically detects connected papers.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { Send, FileText, MessageCircle, Loader2, Link2 } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import { useDebateContextStore } from '@/lib/stores/debateContextStore';
import { useChatContextStore } from '@/lib/stores/chatContextStore';
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
  const initialMessageSentRef = useRef(false);

  const { getPaperForNode } = usePaperContextStore();
  const connectedPaper = getPaperForNode(id);

  // Debate context store for debate-to-chat connections
  const { getDebateForNode } = useDebateContextStore();
  const connectedDebate = getDebateForNode(id);

  // Chat context store for chat-to-chat connections
  const { updateConversation, getUpstreamChats } = useChatContextStore();
  const upstreamChats = getUpstreamChats(id);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update conversation in store whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      updateConversation(
        id,
        messages,
        connectedPaper ? { paperId: connectedPaper.id, title: connectedPaper.title } : undefined
      );
    }
  }, [messages, id, connectedPaper, updateConversation]);

  // Auto-send initial message if provided
  useEffect(() => {
    if (data.initialMessage && !initialMessageSentRef.current && connectedPaper && messages.length === 0) {
      initialMessageSentRef.current = true;
      setInput(data.initialMessage);

      // Trigger send after a short delay to ensure everything is ready
      setTimeout(() => {
        const userMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: data.initialMessage,
          timestamp: new Date(),
        };

        setMessages([userMessage]);
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

        // Send to API
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: data.initialMessage }],
            paperContext: connectedPaper,
            chatContext: upstreamChats,
          }),
        })
          .then(async (response) => {
            if (!response.ok || !response.body) throw new Error('Chat API unavailable');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              accumulatedContent += chunk;

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            }

            data.messages = [userMessage, { ...assistantMessage, content: accumulatedContent }];
          })
          .catch((error) => {
            console.warn('Falling back to client-side response.', error);
            const snippet = (connectedPaper.abstract || connectedPaper.fullText || '').slice(0, 1500);
            const fallbackContent = snippet
              ? `**Question:** ${userMessage.content}\n\n**Paper Context:** ${connectedPaper.title}\n\n**Relevant Text:**\n${snippet}${
                  snippet.length === 1500 ? '...' : ''
                }\n\n---\n\n**Note:** Add your OpenAI API key to \`.env.local\` to enable AI-powered responses.\n\nFor now, here's the relevant context from the paper. The PDF text has been successfully extracted and is available for AI analysis once you configure your API key.`
              : `**No text extracted yet.**\n\nThe PDF content could not be extracted. Try:\n1. Re-uploading the PDF\n2. Using manual text entry\n3. Checking the PDF format\n\nOr add your OpenAI API key to enable AI-powered analysis.`;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fallbackContent }
                  : msg
              )
            );
          })
          .finally(() => {
            setLoading(false);
          });
      }, 100);
    }
  }, [data.initialMessage, connectedPaper, messages.length]);

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
            debateContext: connectedDebate,
            chatContext: upstreamChats,
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
        const snippet = connectedPaper ? (connectedPaper.abstract || connectedPaper.fullText || '').slice(0, 1500) : '';
        const fallbackContent = snippet
          ? `**Question:** ${userMessage.content}\n\n**Paper Context:** ${connectedPaper?.title}\n\n**Relevant Text:**\n${snippet}${
              snippet.length === 1500 ? '...' : ''
            }\n\n---\n\n**Note:** Add your OpenAI API key to \`.env.local\` to enable AI-powered responses.\n\nFor now, here's the relevant context from the paper. The PDF text has been successfully extracted and is available for AI analysis once you configure your API key.`
          : upstreamChats.length > 0
            ? `**Question:** ${userMessage.content}\n\n**Context:** ${upstreamChats.length} previous conversation${upstreamChats.length > 1 ? 's' : ''} available\n\n---\n\n**Note:** Add your OpenAI API key to \`.env.local\` to enable AI-powered responses with full conversation context.`
            : `**No context available.**\n\nConnect a paper or another chat to provide context.\n\nOr add your OpenAI API key to enable AI-powered analysis.`;

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
    [input, loading, messages, connectedPaper, connectedDebate, upstreamChats, data]
  );

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="flex flex-col h-full w-full">
        {/* Minimal header: tiny status + paper chip + debate chip + upstream chats indicator */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className={connectedPaper || connectedDebate || upstreamChats.length > 0 ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'h-1.5 w-1.5 rounded-full bg-amber-500'} />
            {connectedPaper ? (
              <div className="truncate max-w-[180px] rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700">
                <span className="font-medium text-gray-900">Paper:</span> {connectedPaper.title}
              </div>
            ) : connectedDebate ? (
              <div className="truncate max-w-[180px] rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">
                <span className="font-medium text-purple-900">Debate:</span> {connectedDebate.questions.length} questions
              </div>
            ) : (
              <div className="text-[11px] text-gray-500">Chat general</div>
            )}
            {upstreamChats.length > 0 && (
              <div className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                <Link2 className="h-2.5 w-2.5" />
                <span>{upstreamChats.length} chat{upstreamChats.length > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          {messages.length > 0 && (
            <div className="text-[10px] text-gray-400">{messages.length}</div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 bg-white">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <MessageCircle className="h-10 w-10 mb-3" />
              <p className="text-sm text-center px-4">
                {connectedPaper
                  ? 'Ask questions about this paper'
                  : connectedDebate
                  ? 'Ask about the debate results'
                  : upstreamChats.length > 0
                  ? 'Continue the conversation'
                  : 'Start chatting or connect context'}
              </p>
              {upstreamChats.length > 0 && (
                <p className="text-xs text-center px-4 mt-2 text-blue-600">
                  {upstreamChats.length} previous conversation{upstreamChats.length > 1 ? 's' : ''} available
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`px-3 py-2 rounded-xl text-[13px] leading-relaxed max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-900 border border-neutral-200'
                    }`}
                  >
                    {message.role === 'assistant' ? (
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
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="flex-shrink-0 px-3 py-2 bg-white border-t border-gray-100">
          <div className="flex items-center gap-2 w-full rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={connectedPaper || upstreamChats.length > 0 ? 'Escribe tu pregunta…' : 'Escribe tu mensaje…'}
              disabled={loading}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-white disabled:bg-gray-300"
              title="Enviar"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </form>
      </div>
    </BaseNode>
  );
}
