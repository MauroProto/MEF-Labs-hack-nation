/**
 * MAS Debate Node - Completely redesigned with horizontal 3-column layout
 *
 * Always 1200x600, minimalist design, 3 columns at all times
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { Loader2, FileText, AlertCircle, Eye, CheckCircle } from 'lucide-react';
import { usePaperContextStore } from '@/lib/stores/paperContextStore';
import { useDebateContextStore } from '@/lib/stores/debateContextStore';
import { useMasDebate } from '@/lib/hooks/useMasDebate';
import { DebateTranscriptViewer } from '../debate/DebateTranscriptViewer';
import { LiveDebateView } from '../debate/LiveDebateView';
import { Badge } from '../ui/badge';

interface MasDebateNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export function MasDebateNode({ id, data, selected }: MasDebateNodeProps) {
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Set<number>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentPage, setCurrentPage] = useState(0); // 0 = question 1, 1 = question 2, ..., last = final results

  const { getPaperForNode } = usePaperContextStore();
  const { addDebate } = useDebateContextStore();
  const { debateState, loading, fetchQuestions, runEnhancedDebate, reset } = useMasDebate();

  const connectedPaper = getPaperForNode(id);

  // Auto-generate questions when paper is connected
  useEffect(() => {
    if (connectedPaper && debateState.status === 'idle' && !debateState.questions) {
      fetchQuestions(connectedPaper.id).catch(console.error);
    }
  }, [connectedPaper, debateState.status, debateState.questions, fetchQuestions]);

  // Save debate to context store when completed
  useEffect(() => {
    if (debateState.status === 'completed' && debateState.enhancedReport) {
      addDebate(id, debateState.enhancedReport);
    }
  }, [debateState.status, debateState.enhancedReport, id, addDebate]);

  // Toggle question selection
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

  // Start enhanced debate
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
    // ========================================================================
    // LIVE DEBATE VIEW - 3 columns for debaters
    // ========================================================================
    if (debateState.liveMessages && debateState.liveMessages.length > 0) {
      // Calculate total pages (questions + 1 for final results if completed)
      const selectedQuestions = Array.from(selectedQuestionIndices).sort((a, b) => a - b);
      const totalQuestions = selectedQuestions.length;
      const totalPages = debateState.status === 'completed' && debateState.enhancedReport
        ? totalQuestions + 1  // Include final results page
        : totalQuestions;

      // Filter messages for current page
      const currentQuestionMessages = debateState.liveMessages.filter(
        msg => msg.questionIndex === currentPage
      );

      // Check if we're on the final results page
      const isFinalPage = currentPage === totalQuestions;

      return (
        <div className="h-full flex flex-col bg-white">
          {/* Top status bar with navigation */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!isFinalPage && <Loader2 className="h-4 w-4 animate-spin text-gray-700" />}
              <span className="text-sm font-medium text-gray-800">
                {isFinalPage ? 'Resolución Final' : `Pregunta ${currentPage + 1} de ${totalQuestions}`}
              </span>
            </div>

            {/* Navigation arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous"
              >
                ◄
              </button>
              <span className="text-xs text-gray-600 min-w-[60px] text-center">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next"
              >
                ►
              </button>
              {debateState.enhancedReport && (
                <button
                  onClick={() => setShowTranscript(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded hover:bg-gray-900 transition-all ml-2"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Full
                </button>
              )}
            </div>
          </div>

          {/* 3 columns - live debate or final results */}
          <div className="flex-1 overflow-hidden">
            {isFinalPage && debateState.enhancedReport ? (
              <div className="h-full overflow-y-auto p-6 bg-white">
                {/* Rankings */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {debateState.enhancedReport.finalRanking.slice(0, 3).map((rank, i) => (
                    <div key={i} className={`p-6 rounded border-2 ${
                      i === 0 ? 'bg-slate-50 border-slate-400' : i === 1 ? 'bg-stone-50 border-stone-400' : 'bg-zinc-50 border-zinc-400'
                    }`}>
                      <div className="text-center mb-4">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                          i === 0 ? 'bg-yellow-200' : i === 1 ? 'bg-gray-300' : 'bg-orange-200'
                        }`}>
                          <span className="text-xl font-bold">{i + 1}</span>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">{i === 0 ? '1st Place' : i === 1 ? '2nd Place' : '3rd Place'}</div>
                        <div className="font-bold text-sm text-gray-900 mb-2">{rank.posture}</div>
                        <div className="text-2xl font-bold text-gray-800">{rank.averageScore.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {debateState.enhancedReport.overallSummary && (
                  <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-300">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">Overall Summary</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{debateState.enhancedReport.overallSummary}</p>
                  </div>
                )}

                {/* Insights and Controversial Points */}
                <div className="grid grid-cols-2 gap-4">
                  {debateState.enhancedReport.consolidatedInsights && debateState.enhancedReport.consolidatedInsights.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded border border-blue-200">
                      <h3 className="text-sm font-bold text-gray-900 mb-3">Key Insights</h3>
                      <ul className="space-y-2">
                        {debateState.enhancedReport.consolidatedInsights.map((insight, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-blue-600 flex-shrink-0">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {debateState.enhancedReport.consolidatedControversialPoints && debateState.enhancedReport.consolidatedControversialPoints.length > 0 && (
                    <div className="p-4 bg-orange-50 rounded border border-orange-200">
                      <h3 className="text-sm font-bold text-gray-900 mb-3">Controversial Points</h3>
                      <ul className="space-y-2">
                        {debateState.enhancedReport.consolidatedControversialPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-orange-600 flex-shrink-0">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // ALWAYS show live streaming - never remove messages
              <LiveDebateView messages={currentQuestionMessages} postures={debateState.postures} />
            )}
          </div>

          {showTranscript && debateState.enhancedReport && (
            <DebateTranscriptViewer
              report={debateState.enhancedReport}
              onClose={() => setShowTranscript(false)}
            />
          )}
        </div>
      );
    }

    // ========================================================================
    // COMPLETED VIEW - Use same pagination system
    // ========================================================================
    if (debateState.status === 'completed' && debateState.enhancedReport) {
      const totalQuestions = debateState.enhancedReport.questions.length;
      const totalPages = totalQuestions + 1; // questions + final results page
      const isFinalPage = currentPage === totalQuestions;

      // Filter messages for current question
      const currentQuestionMessages = debateState.liveMessages.filter(
        msg => msg.questionIndex === currentPage
      );

      return (
        <div className="h-full flex flex-col bg-white">
          {/* Top bar with navigation */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-300 bg-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-4 w-4 text-green-700" />
              <span className="text-sm font-medium text-gray-800">
                {isFinalPage ? 'Resolución Final' : `Pregunta ${currentPage + 1} de ${totalQuestions}`}
              </span>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous"
              >
                ◄
              </button>
              <span className="text-xs text-gray-600 min-w-[60px] text-center">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next"
              >
                ►
              </button>
              <button
                onClick={() => setShowTranscript(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded hover:bg-gray-900 transition-all ml-2"
              >
                <Eye className="h-3.5 w-3.5" />
                Full
              </button>
            </div>
          </div>

          {/* Content - either question debate or final results */}
          <div className="flex-1 overflow-hidden">
            {isFinalPage ? (
              <div className="h-full overflow-y-auto p-6 bg-white">
                {/* Rankings */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {debateState.enhancedReport.finalRanking.slice(0, 3).map((rank, i) => (
                    <div key={i} className={`p-6 rounded border-2 ${
                      i === 0 ? 'bg-slate-50 border-slate-400' : i === 1 ? 'bg-stone-50 border-stone-400' : 'bg-zinc-50 border-zinc-400'
                    }`}>
                      <div className="text-center mb-4">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                          i === 0 ? 'bg-yellow-200' : i === 1 ? 'bg-gray-300' : 'bg-orange-200'
                        }`}>
                          <span className="text-xl font-bold">{i + 1}</span>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">{i === 0 ? '1st Place' : i === 1 ? '2nd Place' : '3rd Place'}</div>
                        <div className="font-bold text-sm text-gray-900 mb-2">{rank.posture}</div>
                        <div className="text-2xl font-bold text-gray-800">{rank.averageScore.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                {debateState.enhancedReport.overallSummary && (
                  <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-300">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">Overall Summary</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{debateState.enhancedReport.overallSummary}</p>
                  </div>
                )}

                {/* Insights and Controversial Points */}
                <div className="grid grid-cols-2 gap-4">
                  {debateState.enhancedReport.consolidatedInsights && debateState.enhancedReport.consolidatedInsights.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded border border-blue-200">
                      <h3 className="text-sm font-bold text-gray-900 mb-3">Key Insights</h3>
                      <ul className="space-y-2">
                        {debateState.enhancedReport.consolidatedInsights.map((insight, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-blue-600 flex-shrink-0">•</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {debateState.enhancedReport.consolidatedControversialPoints && debateState.enhancedReport.consolidatedControversialPoints.length > 0 && (
                    <div className="p-4 bg-orange-50 rounded border border-orange-200">
                      <h3 className="text-sm font-bold text-gray-900 mb-3">Controversial Points</h3>
                      <ul className="space-y-2">
                        {debateState.enhancedReport.consolidatedControversialPoints.map((point, idx) => (
                          <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-orange-600 flex-shrink-0">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // ALWAYS show live streaming - never remove messages
              <LiveDebateView messages={currentQuestionMessages} postures={debateState.postures} />
            )}
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

    // ========================================================================
    // LOADING STATE
    // ========================================================================
    if (loading || ['generating_postures', 'debating', 'judging', 'generating_report'].includes(debateState.status)) {
      return (
        <div className="h-full flex flex-col bg-white">
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 bg-slate-100">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-700" />
              <span className="text-sm font-medium text-gray-800">{debateState.progress}</span>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">{debateState.progress}</p>
            </div>
          </div>
        </div>
      );
    }

    // ========================================================================
    // ERROR STATE
    // ========================================================================
    if (debateState.status === 'error') {
      return (
        <div className="h-full flex flex-col bg-white">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900 mb-2">Error</p>
              <p className="text-xs text-red-600 mb-4">{debateState.error}</p>
              <button
                onClick={reset}
                className="px-4 py-2 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ========================================================================
    // INITIAL STATE - Question selection with 3 columns
    // ========================================================================
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Top bar - connection status */}
        <div className="flex-shrink-0 px-4 py-2 border-b border-gray-300 bg-slate-100">
          {connectedPaper ? (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-700 flex-shrink-0" />
              <p className="text-sm font-medium text-gray-900 truncate flex-1">
                {connectedPaper.title}
              </p>
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                Connected
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-700" />
              <p className="text-sm text-gray-800">Connect a paper to start</p>
            </div>
          )}
        </div>

        {/* Generating questions */}
        {debateState.status === 'generating_questions' && (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-700 font-medium">Generating questions...</p>
            </div>
          </div>
        )}

        {/* 3 columns - left: info, center+right: questions */}
        {debateState.questions && debateState.questions.length > 0 && (
          <div className="flex-1 grid grid-cols-3 gap-0 divide-x divide-gray-300">
            {/* LEFT COLUMN - Info and controls */}
            <div className="col-span-1 flex flex-col p-4 bg-slate-50">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Multi-Question Debate</h3>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Select at least 2 questions to start a debate with 3 AI perspectives and cross-examination rounds.
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-2 mb-4 flex-1">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800">1</span>
                  </div>
                  <p className="text-xs text-gray-700">Select 2+ questions</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800">2</span>
                  </div>
                  <p className="text-xs text-gray-700">3 AI debaters per question</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800">3</span>
                  </div>
                  <p className="text-xs text-gray-700">Cross-examination rounds</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800">4</span>
                  </div>
                  <p className="text-xs text-gray-700">AI judge evaluation</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-800">5</span>
                  </div>
                  <p className="text-xs text-gray-700">Full transcript available</p>
                </div>
              </div>

              {/* Selection counter */}
              <div className="mt-auto">
                <div className="mb-3 p-3 bg-white border border-gray-300 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Selected</span>
                    <span className="text-lg font-bold text-gray-900">
                      {selectedQuestionIndices.size}
                    </span>
                  </div>
                  {selectedQuestionIndices.size > 0 && selectedQuestionIndices.size < 2 && (
                    <p className="text-xs text-yellow-700 mt-1">Need at least 2</p>
                  )}
                </div>

                <button
                  onClick={handleStartEnhancedDebate}
                  disabled={loading || selectedQuestionIndices.size < 2}
                  className="w-full px-4 py-3 bg-gray-800 text-white font-semibold rounded hover:bg-gray-900 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </span>
                  ) : (
                    `Start Debate (${selectedQuestionIndices.size})`
                  )}
                </button>
              </div>
            </div>

            {/* CENTER + RIGHT COLUMNS - Question list (2 columns) */}
            <div className="col-span-2 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-300 bg-stone-50">
                <h4 className="text-sm font-semibold text-gray-900">Select Questions</h4>
                <p className="text-xs text-gray-600 mt-0.5">
                  {debateState.questions.length} available • {selectedQuestionIndices.size} selected
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-white">
                {debateState.questions.map((question, index) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-3 border-2 rounded cursor-pointer transition-all ${
                      selectedQuestionIndices.has(index)
                        ? 'border-gray-800 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedQuestionIndices.has(index)}
                      onChange={() => toggleQuestionSelection(index)}
                      disabled={loading}
                      className="mt-0.5 h-4 w-4 text-gray-800 border-gray-300 rounded focus:ring-gray-500 flex-shrink-0"
                    />
                    <p className="text-sm text-gray-900 leading-relaxed">{question}</p>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <BaseNode id={id} data={data} selected={selected}>
      {renderContent()}
    </BaseNode>
  );
}
