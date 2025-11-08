/**
 * Researcher Agent Node
 *
 * Deep analysis and evidence extraction agent.
 * Minimal UI with essential controls only.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { Play, Square, CheckCircle, AlertCircle } from 'lucide-react';
import { useAgentStore } from '@/lib/stores/agentStore';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';

interface ResearcherAgentNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

const isWorking = (s: AgentStatus) => s === 'working';

export function ResearcherAgentNode({ id, data, selected }: ResearcherAgentNodeProps) {
  const initialStatus: AgentStatus = (data.status as AgentStatus) || 'idle';
  const [status, setStatus] = useState<AgentStatus>(initialStatus);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(
    data.selectedPaperId || null
  );
  const [output, setOutput] = useState<string>(data.output || '');

  const { getAllPapers } = usePaperContextStore();
  const papers = getAllPapers();

  const handleStart = useCallback(async () => {
    if (!selectedPaperId) return;

    setStatus('working');
    setOutput('');
    data.status = 'working';

    try {
      // TODO: Call backend agent API
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = `Analysis of paper:\n\n• Key claims identified: 5\n• Evidence extracted: 12 passages\n• Methodology: Transformer architecture\n• Results: State-of-the-art performance\n\nDetailed analysis complete.`;

      setOutput(result);
      setStatus('completed');
      data.status = 'completed';
      data.output = result;
    } catch (error) {
      setStatus('error');
      data.status = 'error';
      console.error('Agent error:', error);
    }
  }, [selectedPaperId, data]);

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

        {/* Paper Selection */}
        <select
          value={selectedPaperId || ''}
          onChange={(e) => {
            setSelectedPaperId(e.target.value || null);
            data.selectedPaperId = e.target.value || null;
          }}
          disabled={status === 'working'}
          className="w-full px-2 py-1 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50"
        >
          <option value="">Select paper</option>
          {papers.map(paper => (
            <option key={paper.id} value={paper.id}>
              {paper.title}
            </option>
          ))}
        </select>

        {/* Controls */}
        <div className="flex gap-1.5">
          {status === 'working' ? (
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              <Square className="h-2.5 w-2.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={!selectedPaperId || isWorking(status)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
