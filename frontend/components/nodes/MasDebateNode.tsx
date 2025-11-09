/**
 * MAS Debate Node
 *
 * Improved debate system with question generation and shared topics.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { MessageSquare, Loader2, FileText, AlertCircle } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import { useMasDebate } from '@/lib/hooks/useMasDebate';
import { MasDebateViewer } from '../debate/MasDebateViewer';
import { Badge } from '../ui/badge';

interface MasDebateNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function MasDebateNode({ id, data, selected }: MasDebateNodeProps) {
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);

  const { getPaperForNode } = usePaperContextStore();
  const { debateState, loading, fetchQuestions, runDebate, loadDebateFromHistory, reset } = useMasDebate();

  const connectedPaper = getPaperForNode(id);

  // Auto-generate questions when paper is connected
  useEffect(() => {
    if (connectedPaper && debateState.status === 'idle' && !debateState.questions) {
      fetchQuestions(connectedPaper.id).catch(console.error);
    }
  }, [connectedPaper, debateState.status, debateState.questions, fetchQuestions]);

  const handleSelectQuestion = useCallback(
    async (index: number) => {
      if (!connectedPaper || !debateState.questions) return;

      setSelectedQuestionIndex(index);
      const question = debateState.questions[index];

      try {
        await runDebate(connectedPaper.id, question, 3);
      } catch (err) {
        console.error('Failed to run debate:', err);
      }
    },
    [connectedPaper, debateState.questions, runDebate]
  );

  const handleCustomQuestion = useCallback(async () => {
    if (!connectedPaper || !customQuestion.trim()) return;

    try {
      await runDebate(connectedPaper.id, customQuestion, 3);
    } catch (err) {
      console.error('Failed to run debate:', err);
    }
  }, [connectedPaper, customQuestion, runDebate]);

  const renderContent = () => {
    // Show completed debate with history sidebar
    if (debateState.status === 'completed' && debateState.report && debateState.arguments) {
      return (
        <div className="h-full flex">
          {/* History sidebar */}
          {debateState.history.length > 0 && (
            <div className="w-64 border-r bg-gray-50 flex flex-col">
              <div className="p-3 border-b bg-white">
                <h3 className="text-sm font-semibold text-gray-700">Debate History</h3>
                <p className="text-xs text-gray-500 mt-1">{debateState.history.length} debates</p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {debateState.history.map((entry, idx) => (
                  <button
                    key={entry.id}
                    onClick={() => loadDebateFromHistory(entry.id)}
                    className="w-full text-left p-2 bg-white border border-gray-200 rounded hover:border-purple-300 hover:bg-purple-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-900 line-clamp-2">{entry.question}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 flex flex-col">
            <div className="flex-shrink-0 p-3 border-b flex items-center justify-between">
              <button
                onClick={reset}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                ← Run Another Debate
              </button>
              <Badge variant="default">Completed</Badge>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <MasDebateViewer report={debateState.report} arguments={debateState.arguments} />
            </div>
          </div>
        </div>
      );
    }

    // Show loading/progress
    if (loading || ['generating_postures', 'debating', 'judging', 'generating_report'].includes(debateState.status)) {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
            <div className="text-center">
              <p className="font-medium text-gray-900">{debateState.progress}</p>
              <Badge variant="secondary" className="mt-2">
                {debateState.status.replace('_', ' ')}
              </Badge>
            </div>

            {/* Show progress details */}
            {debateState.postures && (
              <div className="w-full max-w-md bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Postures:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {debateState.postures.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {debateState.topics && (
              <div className="w-full max-w-md bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Topics:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {debateState.topics.map((t, i) => (
                    <li key={i}>• {t}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Show per-debater progress */}
            {debateState.debaterProgress.length > 0 && (
              <div className="w-full max-w-md bg-white border-2 border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Debater Progress:</p>
                <div className="space-y-3">
                  {debateState.debaterProgress.map((debater, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {debater.status === 'idle' && (
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-xs text-gray-500">{i + 1}</span>
                          </div>
                        )}
                        {debater.status === 'running' && (
                          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        )}
                        {debater.status === 'complete' && (
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        {debater.status === 'error' && (
                          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                            <AlertCircle className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          Debater {i + 1}: {debater.posture}
                        </p>
                        <p className="text-xs text-gray-500">
                          {debater.status === 'idle' && 'Waiting...'}
                          {debater.status === 'running' && 'Generating argument...'}
                          {debater.status === 'complete' && 'Complete'}
                          {debater.status === 'error' && `Error: ${debater.error}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Show error
    if (debateState.status === 'error') {
      return (
        <div className="h-full flex flex-col p-4">
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-900 mb-2">Debate Failed</p>
              <p className="text-sm text-red-600">{debateState.error}</p>
            </div>
            <button
              onClick={reset}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Show question selection
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
              Please connect a paper node to start a debate
            </p>
          </div>
        )}

        {/* Generated Questions */}
        {debateState.status === 'generating_questions' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="ml-3 text-gray-600">Generating questions...</p>
          </div>
        )}

        {debateState.questions && debateState.questions.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Select a Question to Debate:
            </h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {debateState.questions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectQuestion(index)}
                  disabled={loading}
                  className="w-full text-left p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="text-sm text-gray-900">{question}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Question Input */}
        {connectedPaper && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Or Enter Custom Question:
            </h4>
            <textarea
              className="w-full h-24 p-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="E.g., 'To what extent does this approach improve upon existing methods?'"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              disabled={loading}
            />
            <button
              onClick={handleCustomQuestion}
              disabled={loading || !customQuestion.trim()}
              className="mt-2 w-full px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Start Debate with Custom Question
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-auto p-3 bg-gray-50 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-700 mb-1">
            How the improved debate works:
          </h4>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>Select or create a research question</li>
            <li>3 AI debaters get different perspectives (postures)</li>
            <li>ALL debaters argue the SAME topics from their perspectives</li>
            <li>AI judge scores each debater per topic and overall</li>
            <li>Comprehensive report with insights and recommendations</li>
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
      title="Academic Debate (MAS)"
      color="#8B5CF6"
    >
      {renderContent()}
    </BaseNode>
  );
}
