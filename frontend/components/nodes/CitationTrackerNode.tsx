/**
 * Citation Tracker Node
 *
 * Verifies citations and builds citation graphs.
 * Minimal, data-focused UI.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { Play, Square, CheckCircle, AlertCircle } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';

interface CitationTrackerNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

const isWorking = (s: AgentStatus) => s === 'working';

interface CitationStats {
  total: number;
  verified: number;
  missing: number;
  invalid: number;
}

export function CitationTrackerNode({ id, data, selected }: CitationTrackerNodeProps) {
  const initialStatus: AgentStatus = (data.status as AgentStatus) || 'idle';
  const [status, setStatus] = useState<AgentStatus>(initialStatus);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(
    data.selectedPaperId || null
  );
  const [stats, setStats] = useState<CitationStats | null>(data.stats || null);

  const { getAllPapers } = usePaperContextStore();
  const papers = getAllPapers();

  const handleTrack = useCallback(async () => {
    if (!selectedPaperId) return;

    setStatus('working');
    setStats(null);
    data.status = 'working';

    try {
      // TODO: Call backend agent API
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result: CitationStats = {
        total: 47,
        verified: 42,
        missing: 3,
        invalid: 2,
      };

      setStats(result);
      setStatus('completed');
      data.status = 'completed';
      data.stats = result;
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
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-red-500 text-white rounded hover:bg-red-600"
            >
              <Square className="h-2.5 w-2.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleTrack}
              disabled={!selectedPaperId || isWorking(status)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Play className="h-2.5 w-2.5" />
              Run
            </button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="p-1.5 bg-gray-50 rounded border border-gray-200">
              <div className="text-[10px] text-gray-500">Total</div>
              <div className="text-sm font-semibold">{stats.total}</div>
            </div>
            <div className="p-1.5 bg-green-50 rounded border border-green-200">
              <div className="text-[10px] text-green-600">OK</div>
              <div className="text-sm font-semibold text-green-700">{stats.verified}</div>
            </div>
            <div className="p-1.5 bg-yellow-50 rounded border border-yellow-200">
              <div className="text-[10px] text-yellow-600">Miss</div>
              <div className="text-sm font-semibold text-yellow-700">{stats.missing}</div>
            </div>
            <div className="p-1.5 bg-red-50 rounded border border-red-200">
              <div className="text-[10px] text-red-600">Err</div>
              <div className="text-sm font-semibold text-red-700">{stats.invalid}</div>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
