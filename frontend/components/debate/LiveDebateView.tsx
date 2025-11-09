'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { LiveStreamMessage } from '@/lib/hooks/useMasDebate';

interface LiveDebateViewProps {
  messages: LiveStreamMessage[];
  postures?: string[];
}

/**
 * Extract clean text from JSON or raw text
 * Handles streaming/incomplete JSON from debate agents
 */
function extractCleanText(rawText: string): string {
  if (!rawText) return '';

  const text = rawText.trim();

  // Try to parse as complete JSON first
  try {
    // Remove markdown code blocks if present
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Extract from simple response objects
    if (parsed.response) return parsed.response;
    if (parsed.question) return parsed.question;
    if (parsed.overallPosition) return parsed.overallPosition;

    // Extract from perTopic structure (debater arguments)
    if (parsed.perTopic && Array.isArray(parsed.perTopic)) {
      return parsed.perTopic
        .map((topic: any) => {
          let output = `### ${topic.topic}\n\n`;
          if (topic.claim) output += `**Claim:** ${topic.claim}\n\n`;
          if (topic.reasoning) output += `${topic.reasoning}\n\n`;
          if (topic.counterpoints && Array.isArray(topic.counterpoints) && topic.counterpoints.length > 0) {
            output += `**Counterpoints:**\n${topic.counterpoints.map((cp: string) => `- ${cp}`).join('\n')}\n\n`;
          }
          return output;
        })
        .join('\n');
    }

    // If parsed but no recognized structure, return as-is
    return text;
  } catch (e) {
    // JSON parsing failed - likely incomplete/streaming JSON
    // Extract readable text using multiple strategies

    // Strategy 1: Extract all complete string values from partial JSON
    const allTextContent: string[] = [];

    // Match complete "key": "value" pairs
    const completeFieldRegex = /"(?:reasoning|claim|response|question|overallPosition|topic|posture)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let match;
    while ((match = completeFieldRegex.exec(text)) !== null) {
      if (match[1]) {
        // Unescape JSON string
        const unescaped = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        allTextContent.push(unescaped);
      }
    }

    // Strategy 2: Extract from perTopic array structure
    const perTopicMatch = text.match(/"perTopic"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
    if (perTopicMatch) {
      const perTopicContent = perTopicMatch[1];

      // Extract topic blocks
      const topicBlocks = perTopicContent.split(/\},\s*\{/);
      const formattedTopics = topicBlocks.map(block => {
        let output = '';

        const topicName = block.match(/"topic"\s*:\s*"([^"]+)"/);
        if (topicName) output += `### ${topicName[1]}\n\n`;

        const claim = block.match(/"claim"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (claim) {
          const unescaped = claim[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          output += `**Claim:** ${unescaped}\n\n`;
        }

        const reasoning = block.match(/"reasoning"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (reasoning) {
          const unescaped = reasoning[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          output += `${unescaped}\n\n`;
        }

        return output;
      }).filter(s => s.trim());

      if (formattedTopics.length > 0) {
        return formattedTopics.join('\n');
      }
    }

    // Strategy 3: If we found any complete fields, combine them
    if (allTextContent.length > 0) {
      return allTextContent.join('\n\n');
    }

    // Strategy 4: Last resort - check if text looks like pure JSON
    // If it starts with { and has no readable text, show placeholder
    if (text.startsWith('{') && !text.match(/[a-zA-Z]{10,}/)) {
      return ''; // Don't show incomplete JSON fragments
    }

    // If all else fails and there's readable content, return it
    return text;
  }
}

export function LiveDebateView({ messages, postures }: LiveDebateViewProps) {
  // Group messages by debater - each column shows only what THAT debater says
  const messagesByDebater = useMemo(() => {
    const grouped: Record<number, LiveStreamMessage[]> = {
      0: [],
      1: [],
      2: [],
    };

    messages.forEach((msg) => {
      if (msg.type === 'debater' && msg.debaterIndex !== undefined) {
        // Initial argument - goes to that debater's column
        grouped[msg.debaterIndex].push(msg);
      } else if (msg.type === 'question') {
        // Question - goes to the column of who ASKED it
        const debaterIndex = postures?.findIndex((p) => p === msg.fromDebater);
        if (debaterIndex !== undefined && debaterIndex >= 0) {
          grouped[debaterIndex].push(msg);
        }
      } else if (msg.type === 'response') {
        // Response - goes to the column of who ANSWERED it
        const debaterIndex = postures?.findIndex((p) => p === msg.toDebater);
        if (debaterIndex !== undefined && debaterIndex >= 0) {
          grouped[debaterIndex].push(msg);
        }
      }
    });

    return grouped;
  }, [messages, postures]);

  const getPostureName = (index: number): string => {
    return postures?.[index] || `Debater ${index + 1}`;
  };

  const getColumnColor = (index: number): string => {
    const colors = [
      'border-slate-300 bg-slate-50',
      'border-stone-300 bg-stone-50',
      'border-zinc-300 bg-zinc-50',
    ];
    return colors[index % colors.length];
  };

  const getHeaderColor = (index: number): string => {
    const colors = [
      'bg-slate-100 text-slate-700',
      'bg-stone-100 text-stone-700',
      'bg-zinc-100 text-zinc-700',
    ];
    return colors[index % colors.length];
  };

  const renderMessage = (msg: LiveStreamMessage, index: number) => {
    const showCursor = !msg.isComplete;
    const cleanText = extractCleanText(msg.text);

    if (msg.type === 'debater') {
      return (
        <div key={index} className="mb-4">
          <div className="text-xs font-semibold text-gray-600 mb-2">Initial Argument</div>
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleanText}
            </ReactMarkdown>
            {showCursor && (
              <span className="inline-block w-0.5 h-4 ml-1 bg-gray-600 animate-pulse align-middle" />
            )}
          </div>
          {showCursor && (
            <div className="text-xs text-gray-500 mt-2 italic">Writing...</div>
          )}
        </div>
      );
    }

    if (msg.type === 'question') {
      return (
        <div key={index} className="mb-4 pl-3 border-l-2 border-gray-400">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            {msg.fromDebater} asks {msg.toDebater}:
          </div>
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleanText}
            </ReactMarkdown>
            {showCursor && (
              <span className="inline-block w-0.5 h-4 ml-1 bg-gray-500 animate-pulse align-middle" />
            )}
          </div>
        </div>
      );
    }

    if (msg.type === 'response') {
      return (
        <div key={index} className="mb-4 pl-3 border-l-2 border-gray-600">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            {msg.toDebater} responds to {msg.fromDebater}:
          </div>
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleanText}
            </ReactMarkdown>
            {showCursor && (
              <span className="inline-block w-0.5 h-4 ml-1 bg-gray-600 animate-pulse align-middle" />
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-white">
      <div className="grid grid-cols-3 gap-0 divide-x divide-gray-300 min-h-full">
        {[0, 1, 2].map((debaterIndex) => (
          <div key={debaterIndex} className={`flex flex-col ${getColumnColor(debaterIndex)}`}>
            {/* Column Header - Sticky */}
            <div className={`sticky top-0 z-10 px-4 py-3 border-b border-gray-300 ${getHeaderColor(debaterIndex)}`}>
              <div className="text-sm font-bold truncate leading-tight">
                {getPostureName(debaterIndex)}
              </div>
              <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                <span>
                  {messagesByDebater[debaterIndex].filter(m => m.isComplete).length} / {messagesByDebater[debaterIndex].length} complete
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="p-4">
              {messagesByDebater[debaterIndex].length > 0 ? (
                <div className="space-y-3">
                  {messagesByDebater[debaterIndex].map((msg, idx) =>
                    renderMessage(msg, idx)
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-sm py-12">
                  <div className="mb-2">
                    <div className="inline-block w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  </div>
                  <div>Waiting for debater...</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
