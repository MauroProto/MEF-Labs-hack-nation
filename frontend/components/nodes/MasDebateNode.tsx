/**
 * MAS Debate Node
 *
 * Improved debate system with question generation and shared topics.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { MessageSquare, Loader2, FileText, AlertCircle, Eye } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import { useMasDebate } from '@/lib/hooks/useMasDebate';
import { MasDebateViewer } from '../debate/MasDebateViewer';
import { DebateTranscriptViewer } from '../debate/DebateTranscriptViewer';
import { Badge } from '../ui/badge';

interface MasDebateNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function MasDebateNode({ id, data, selected }: MasDebateNodeProps) {
  const [customQuestion, setCustomQuestion] = useState('');
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Set<number>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);

  const { getPaperForNode } = usePaperContextStore();
  const { debateState, loading, fetchQuestions, runEnhancedDebate, loadDebateFromHistory, reset } = useMasDebate();

  const connectedPaper = getPaperForNode(id);

  // Auto-generate questions when paper is connected
  useEffect(() => {
    if (connectedPaper && debateState.status === 'idle' && !debateState.questions) {
      fetchQuestions(connectedPaper.id).catch(console.error);
    }
  }, [connectedPaper, debateState.status, debateState.questions, fetchQuestions]);

  // Toggle question selection (checkboxes)
  const toggleQuestionSelection = useCallback((index: number) => {
    setSelectedQuestionIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Start enhanced debate with selected questions
  const handleStartEnhancedDebate = useCallback(async () => {
    if (!connectedPaper || !debateState.questions || selectedQuestionIndices.size < 2) return;

    const selectedQuestions = Array.from(selectedQuestionIndices)
      .sort((a, b) => a - b)
      .map(index => debateState.questions![index]);

    try {
      await runEnhancedDebate(connectedPaper.id, selectedQuestions, 3, 2);
    } catch (err) {
      console.error('Failed to run enhanced debate:', err);
    }
  }, [connectedPaper, debateState.questions, selectedQuestionIndices, runEnhancedDebate]);

  const renderContent = () => {
    // Show completed ENHANCED debate with transcript viewer
    if (debateState.status === 'completed' && debateState.enhancedReport) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 p-3 border-b flex items-center justify-between gap-2">
            <button
              onClick={reset}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Run Another Debate
            </button>
            <button
              onClick={() => setShowTranscript(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm"
            >
              <Eye className="h-4 w-4" />
              View Full Transcript
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Debate Complete!</div>
              <div className="text-xs text-gray-600">
                {debateState.enhancedReport.questions.length} questions debated with {debateState.enhancedReport.debateResults[0]?.postures.length || 3} postures each
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-purple-900 mb-1">Winner:</div>
                <div className="text-sm font-bold text-purple-700">
                  {debateState.enhancedReport.finalRanking[0]?.posture}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  Score: {(debateState.enhancedReport.finalRanking[0]?.averageScore * 100).toFixed(1)}%
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2">Summary:</div>
                <p className="text-xs text-gray-600">
                  {debateState.enhancedReport.overallSummary}
                </p>
              </div>

              {debateState.enhancedReport.consolidatedInsights.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">Key Insights:</div>
                  <ul className="space-y-1">
                    {debateState.enhancedReport.consolidatedInsights.slice(0, 3).map((insight, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                        <span className="text-purple-600">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {showTranscript && (
            <DebateTranscriptViewer
              report={debateState.enhancedReport}
              onClose={() => setShowTranscript(false)}
            />
          )}
        </div>
      );
    }

    // Show completed single debate with history sidebar (old flow)
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
            {debateState.debaterProgress && debateState.debaterProgress.length > 0 && (
              <div className="w-full max-w-md bg-white border-2 border-gray-200 rounded-lg p-4 max-h-96 flex flex-col">
                <p className="text-sm font-semibold text-gray-700 mb-3">Debater Progress:</p>
                <div className="space-y-3 overflow-y-auto flex-1">
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

                        {/* Show argument preview when complete */}
                        {debater.status === 'complete' && debater.argument && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs max-w-full">
                            {debater.argument.perTopic && debater.argument.perTopic.length > 0 && (
                              <div className="space-y-2">
                                <div>
                                  <p className="font-semibold text-green-900 mb-1">
                                    {debater.argument.perTopic[0].topic}:
                                  </p>
                                  <p className="text-gray-700 line-clamp-2 mb-1">
                                    <span className="font-medium">Claim:</span> {debater.argument.perTopic[0].claim}
                                  </p>
                                  <p className="text-gray-600 text-xs line-clamp-2">
                                    {debater.argument.perTopic[0].reasoning}
                                  </p>
                                </div>
                                {debater.argument.perTopic.length > 1 && (
                                  <p className="text-xs text-gray-500 italic">
                                    +{debater.argument.perTopic.length - 1} more topic(s)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show debate rounds in real-time */}
            {debateState.currentRounds && debateState.currentRounds.length > 0 && (
              <div className="w-full max-w-md bg-white border-2 border-purple-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="text-sm font-semibold text-purple-700 mb-3">
                  Debate Rounds ({debateState.currentRounds.length}):
                </p>
                <div className="space-y-3">
                  {debateState.currentRounds.map((round) => (
                    <div key={round.roundNumber} className="bg-purple-50 border border-purple-200 rounded p-3">
                      <div className="text-xs font-semibold text-purple-900 mb-2">
                        Round {round.roundNumber}
                      </div>
                      <div className="space-y-2">
                        {round.exchanges.map((exchange, i) => (
                          <div key={i} className="text-xs pl-2 border-l-2 border-purple-300">
                            <div className="font-medium text-blue-700 mb-1">
                              {exchange.fromDebater} → {exchange.toDebater}
                            </div>
                            <div className="text-gray-600 italic mb-1">
                              Q: "{exchange.question.substring(0, 80)}{exchange.question.length > 80 ? '...' : ''}"
                            </div>
                            <div className="text-gray-800">
                              A: {exchange.response.substring(0, 100)}{exchange.response.length > 100 ? '...' : ''}
                            </div>
                          </div>
                        ))}
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
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
              <span>Select Questions to Debate (minimum 2):</span>
              <span className="text-xs text-purple-600 font-medium">
                {selectedQuestionIndices.size} selected
              </span>
            </h4>

            {selectedQuestionIndices.size > 0 && selectedQuestionIndices.size < 2 && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                Please select at least 2 questions for a meaningful debate
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
              {debateState.questions.map((question, index) => (
                <label
                  key={index}
                  className={`flex items-start gap-3 p-3 bg-white border-2 rounded-lg cursor-pointer transition-all ${
                    selectedQuestionIndices.has(index)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedQuestionIndices.has(index)}
                    onChange={() => toggleQuestionSelection(index)}
                    disabled={loading}
                    className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <p className="text-sm text-gray-900 flex-1">{question}</p>
                </label>
              ))}
            </div>

            <button
              onClick={handleStartEnhancedDebate}
              disabled={loading || selectedQuestionIndices.size < 2}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-md disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Enhanced Debate...
                </span>
              ) : (
                `Start Enhanced Debate (${selectedQuestionIndices.size} questions, 2 rounds)`
              )}
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-auto p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <h4 className="text-xs font-semibold text-purple-900 mb-2 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Enhanced Multi-Question Debate:
          </h4>
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
            <li>Select <strong>multiple questions</strong> (minimum 2) for richer debate</li>
            <li>For each question: 3 AI debaters get different postures</li>
            <li>Initial arguments generated for all topics</li>
            <li><strong>Debate rounds:</strong> Debaters question each other (like presidential debates!)</li>
            <li>AI judge evaluates full debate + cross-examination</li>
            <li>Consolidated report across all questions with transcript</li>
          </ol>
        </div>
      </div>
    );
  };

  return (
    <BaseNode id={id} data={data} selected={selected}>
      {renderContent()}
    </BaseNode>
  );
}
