/**
 * Critic Agent Node
 *
 * Validates claims and identifies weaknesses.
 * Minimal UI design.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { Play, Square, CheckCircle, AlertCircle } from 'lucide-react';

interface CriticAgentNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

const isWorking = (s: AgentStatus) => s === 'working';

export function CriticAgentNode({ id, data, selected }: CriticAgentNodeProps) {
  const [status, setStatus] = useState<AgentStatus>((data.status as AgentStatus) || 'idle');
  const [input, setInput] = useState<string>(data.input || '');
  const [output, setOutput] = useState<string>(data.output || '');

  const handleStart = useCallback(async () => {
    if (!input.trim()) return;

    setStatus('working');
    setOutput('');
    data.status = 'working';

    try {
      // TODO: Call backend agent API
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = `Critique:\n\n✓ Valid: 3 claims\n✗ Weak: 2 claims\n? Needs verification: 1 claim\n\nKey concerns:\n• Sample size limitations\n• Missing baseline comparisons\n\nRecommendations:\n• Add statistical significance tests\n• Include ablation studies`;

      setOutput(result);
      setStatus('completed');
      data.status = 'completed';
      data.output = result;
    } catch (error) {
      setStatus('error');
      data.status = 'error';
      console.error('Agent error:', error);
    }
  }, [input, data]);

  const handleStop = useCallback(() => {
    setStatus('idle');
    data.status = 'idle';
  }, [data]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-2">
        {/* Status */}
        <div className="flex items-center gap-1.5">
          {status === 'idle' && <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />}
          {status === 'working' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
          {status === 'completed' && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
          {status === 'error' && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
          <span className="text-gray-500 text-[10px] uppercase tracking-wide">{status}</span>
        </div>

        {/* Input */}
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            data.input = e.target.value;
          }}
          placeholder="Text to critique..."
          disabled={isWorking(status)}
          className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none disabled:bg-gray-50"
          rows={3}
        />

        {/* Controls */}
        <div className="flex gap-1.5">
          {status === 'working' ? (
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-red-500 text-white rounded hover:bg-red-600"
            >
              <Square className="h-2.5 w-2.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!input.trim() || isWorking(status)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Play className="h-2.5 w-2.5" />
              Run
            </button>
          )}
        </div>

        {/* Output */}
        {output && (
          <div className="p-1.5 bg-gray-50 rounded border border-gray-200 text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
            {output}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
