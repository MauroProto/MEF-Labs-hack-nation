/**
 * Debate Transcript Viewer
 *
 * Shows the full debate transcript with all questions, arguments, and rounds
 */

'use client';

import React from 'react';
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';

type DebateExchange = {
  fromDebater: string;
  toDebater: string;
  question: string;
  response: string;
  timestamp: number;
};

type DebateRound = {
  roundNumber: number;
  exchanges: DebateExchange[];
};

type QuestionDebateResult = {
  question: string;
  postures: string[];
  topics: string[];
  initialArguments: any[];
  rounds: DebateRound[];
  verdict: any;
};

type EnhancedDebateReport = {
  questions: string[];
  debateResults: QuestionDebateResult[];
  overallSummary: string;
  consolidatedInsights: string[];
  consolidatedControversialPoints: string[];
  finalRanking: Array<{
    posture: string;
    averageScore: number;
  }>;
  markdown: string;
};

interface DebateTranscriptViewerProps {
  report: EnhancedDebateReport;
  onClose: () => void;
}

export function DebateTranscriptViewer({ report, onClose }: DebateTranscriptViewerProps) {
  const [expandedQuestions, setExpandedQuestions] = React.useState<Set<number>>(new Set([0]));
  const [expandedRounds, setExpandedRounds] = React.useState<Set<string>>(new Set());

  const toggleQuestion = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  const toggleRound = (questionIndex: number, roundNumber: number) => {
    const key = `${questionIndex}-${roundNumber}`;
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRounds(newExpanded);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Enhanced Debate Transcript</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-semibold text-xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overall Summary */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">Overall Summary</h3>
            <p className="text-sm text-purple-800">{report.overallSummary}</p>
          </div>

          {/* Final Ranking */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Final Ranking</h3>
            <div className="space-y-2">
              {report.finalRanking.map((entry, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                return (
                  <div key={entry.posture} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{medal}</span>
                      <span className="font-medium text-gray-900">{entry.posture}</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-600">
                      {(entry.averageScore * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Debate Results per Question */}
          {report.debateResults.map((result, qIndex) => (
            <div key={qIndex} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Question Header */}
              <button
                onClick={() => toggleQuestion(qIndex)}
                className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedQuestions.has(qIndex) ? (
                    <ChevronDown className="h-5 w-5 text-gray-600" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  )}
                  <h3 className="font-semibold text-gray-900 text-left">
                    Question {qIndex + 1}: {result.question}
                  </h3>
                </div>
              </button>

              {/* Question Content */}
              {expandedQuestions.has(qIndex) && (
                <div className="p-4 space-y-4">
                  {/* Postures */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Postures</h4>
                    <div className="space-y-1">
                      {result.postures.map((posture, pIndex) => (
                        <div key={pIndex} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="font-medium">{pIndex + 1}.</span>
                          <span>{posture}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Initial Arguments */}
                  {result.initialArguments && result.initialArguments.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Initial Arguments</h4>
                      <div className="space-y-3">
                        {result.initialArguments.map((arg, aIndex) => (
                          <div key={aIndex} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <div className="font-medium text-sm text-gray-900 mb-2">
                              {result.postures[aIndex]}
                            </div>
                            {arg.perTopic && arg.perTopic.map((topic: any, tIndex: number) => (
                              <div key={tIndex} className="mb-3 last:mb-0">
                                <div className="text-xs font-semibold text-gray-700 mb-1">{topic.topic}</div>
                                {topic.claim && (
                                  <div className="text-xs text-gray-600 mb-1">
                                    <span className="font-medium">Claim:</span> {topic.claim}
                                  </div>
                                )}
                                {topic.reasoning && (
                                  <div className="text-xs text-gray-600">
                                    {topic.reasoning}
                                  </div>
                                )}
                              </div>
                            ))}
                            {arg.overallPosition && (
                              <div className="mt-2 pt-2 border-t border-gray-300">
                                <div className="text-xs text-gray-700 italic">{arg.overallPosition}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debate Rounds */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Debate Rounds</h4>
                    <div className="space-y-3">
                      {result.rounds.map((round) => {
                        const roundKey = `${qIndex}-${round.roundNumber}`;
                        const isExpanded = expandedRounds.has(roundKey);

                        return (
                          <div key={round.roundNumber} className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleRound(qIndex, round.roundNumber)}
                              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                )}
                                <span className="text-sm font-medium text-gray-900">
                                  Round {round.roundNumber} ({round.exchanges.length} exchanges)
                                </span>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="p-3 space-y-3">
                                {round.exchanges.map((exchange, eIndex) => (
                                  <div key={eIndex} className="bg-white border border-gray-100 rounded p-3 space-y-2">
                                    {/* Question */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <MessageSquare className="h-3 w-3 text-blue-500" />
                                        <span className="text-xs font-semibold text-blue-700">
                                          {exchange.fromDebater} asks {exchange.toDebater}:
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 italic pl-5">
                                        "{exchange.question}"
                                      </p>
                                    </div>

                                    {/* Response */}
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <MessageSquare className="h-3 w-3 text-green-500" />
                                        <span className="text-xs font-semibold text-green-700">
                                          {exchange.toDebater} responds:
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 pl-5">
                                        {exchange.response}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Winner for this Question */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-green-900">Winner for this question:</span>
                      <span className="text-sm font-bold text-green-700">{result.verdict.bestOverall}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Insights */}
          {report.consolidatedInsights.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Key Insights</h3>
              <ul className="space-y-2">
                {report.consolidatedInsights.map((insight, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Controversial Points */}
          {report.consolidatedControversialPoints.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Controversial Points</h3>
              <ul className="space-y-2">
                {report.consolidatedControversialPoints.map((point, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-orange-600 font-bold">⚠</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-3">
          <button
            onClick={() => {
              const blob = new Blob([report.markdown], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'debate-transcript.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
          >
            Download Markdown
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
