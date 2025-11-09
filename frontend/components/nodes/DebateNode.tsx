/**
 * Debate Node
 *
 * Initiates and displays academic debates about research papers.
 */

'use client';

import React, { useState, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { MessageSquare, Play, Eye, Loader2, FileText } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import { useDebate } from '@/lib/hooks/useDebate';
import { DebateViewer } from '../debate/DebateViewer';
import { Badge } from '../ui/badge';

interface DebateNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function DebateNode({ id, data, selected }: DebateNodeProps) {
  const [sessionId, setSessionId] = useState<string | null>(data.sessionId || null);
  const [showViewer, setShowViewer] = useState(false);
  const [researchAnalysis, setResearchAnalysis] = useState(
    data.researchAnalysis || ''
  );

  const { getPaperForNode } = usePaperContextStore();
  const { startDebate, loading, error, getLocalSession } = useDebate();
  const connectedPaper = getPaperForNode(id);

  const session = sessionId ? getLocalSession(sessionId) : null;

  const handleStartDebate = useCallback(async () => {
    if (!researchAnalysis.trim() && !connectedPaper) {
      alert('Please connect a paper or provide research analysis');
      return;
    }

    try {
      // Use provided analysis or generate from connected paper
      const analysis =
        researchAnalysis.trim() ||
        `Research Analysis of "${connectedPaper?.title}":\n\n${connectedPaper?.abstract || connectedPaper?.fullText?.substring(0, 2000)}`;

      const result = await startDebate({
        researchAnalysis: analysis,
        paperId: connectedPaper?.id,
      });

      setSessionId(result.sessionId);
      setShowViewer(true);

      // Update node data
      if (data.onUpdate) {
        data.onUpdate({
          sessionId: result.sessionId,
          researchAnalysis: analysis,
        });
      }
    } catch (err) {
      console.error('Failed to start debate:', err);
    }
  }, [researchAnalysis, connectedPaper, startDebate, data]);

  const renderContent = () => {
    if (showViewer && sessionId) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 p-3 border-b flex items-center justify-between">
            <button
              onClick={() => setShowViewer(false)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <Badge variant={session?.status === 'completed' ? 'default' : 'secondary'}>
              {session?.status || 'Loading...'}
            </Badge>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <DebateViewer sessionId={sessionId} />
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col p-4">
        {/* Connection Status */}
        {connectedPaper ? (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-green-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-900 truncate">
                {connectedPaper.title}
              </p>
              <p className="text-xs text-green-700">Connected Paper</p>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Connect a paper node or provide research analysis below
            </p>
          </div>
        )}

        {/* Research Analysis Input */}
        {!connectedPaper && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Research Analysis
            </label>
            <textarea
              className="w-full h-32 p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter research findings to debate about..."
              value={researchAnalysis}
              onChange={(e) => setResearchAnalysis(e.target.value)}
              disabled={loading}
            />
          </div>
        )}

        {/* Existing Session */}
        {sessionId && !showViewer && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-blue-900">Active Debate</p>
              <Badge variant={session?.status === 'completed' ? 'default' : 'secondary'}>
                {session?.status || 'Loading...'}
              </Badge>
            </div>
            <p className="text-xs text-blue-700 mb-3">
              Session: {sessionId.slice(0, 8)}...
            </p>
            <button
              onClick={() => setShowViewer(true)}
              className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Debate
            </button>
          </div>
        )}

        {/* Start Button */}
        <button
          onClick={handleStartDebate}
          disabled={loading || (!researchAnalysis.trim() && !connectedPaper)}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Starting Debate...
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              {sessionId ? 'Start New Debate' : 'Start Debate'}
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Info */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-700 mb-1">How it works:</h4>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>3 AI debaters analyze the research from different perspectives</li>
            <li>4 rounds of structured debate (exposition + cross-examination)</li>
            <li>AI judge evaluates arguments and declares a verdict</li>
            <li>Real-time updates as the debate progresses</li>
          </ol>
        </div>
      </div>
    );
  };

  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      icon={MessageSquare}
      title="Academic Debate"
      color="#8B5CF6"
    >
      {renderContent()}
    </BaseNode>
  );
}
