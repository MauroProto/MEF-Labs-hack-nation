/**
 * Synthesizer Agent Node
 *
 * Merges analyses and resolves conflicts.
 * Minimal, clean UI.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { Play, Square, CheckCircle, AlertCircle } from 'lucide-react';

interface SynthesizerAgentNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

const isWorking = (s: AgentStatus) => s === 'working';

export function SynthesizerAgentNode({ id, data, selected }: SynthesizerAgentNodeProps) {
  const initialStatus: AgentStatus = (data.status as AgentStatus) || 'idle';
  const [status, setStatus] = useState<AgentStatus>(initialStatus);
  const [inputCount, setInputCount] = useState<number>(data.inputCount || 0);
  const [output, setOutput] = useState<string>(data.output || '');

  const handleStart = useCallback(async () => {
    setStatus('working');
    setOutput('');
    data.status = 'working';

    try {
      // TODO: Call backend agent API to synthesize connected inputs
      await new Promise(resolve => setTimeout(resolve, 2500));

      const result = `Synthesis:\n\nMerged ${inputCount || 2} analyses\n\nConsensus findings:\n• Core methodology validated\n• 4 key claims confirmed\n• 1 conflicting interpretation resolved\n\nFinal assessment: Strong evidence with minor caveats\n\nConfidence: 85%`;

      setOutput(result);
      setStatus('completed');
      data.status = 'completed';
      data.output = result;
    } catch (error) {
      setStatus('error');
      data.status = 'error';
      console.error('Agent error:', error);
    }
  }, [inputCount, data]);

  const handleStop = useCallback(() => {
    setStatus('idle');
    data.status = 'idle';
  }, [data]);

  return (
    <BaseNode id={id} data={data} selected={selected}>
      <div className="space-y-2">
        {/* Status - Minimal */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {status === 'idle' && <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />}
            {status === 'working' && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
            {status === 'completed' && <div className="h-1.5 w-1.5 rounded-full bg-green-500" />}
            {status === 'error' && <div className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            <span className="text-gray-500 text-[10px] uppercase tracking-wide">{status}</span>
          </div>
          <span className="text-gray-400 text-[10px]">{inputCount || 0}</span>
        </div>

        {/* Controls - Minimal */}
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
              disabled={isWorking(status)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Play className="h-2.5 w-2.5" />
              Run
            </button>
          )}
        </div>

        {/* Output - Minimal */}
        {output && (
          <div className="p-1.5 bg-gray-50 rounded border border-gray-200 text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
            {output}
          </div>
        )}
      </div>
    </BaseNode>
  );
}
