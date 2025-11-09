'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { QuestionDebateResult } from '@/lib/api/masDebateApi';

interface QuestionDebateViewProps {
  result: QuestionDebateResult;
}

export function QuestionDebateView({ result }: QuestionDebateViewProps) {
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

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden bg-white">
      <div className="grid grid-cols-3 gap-0 divide-x divide-gray-300 min-h-full">
        {[0, 1, 2].map((debaterIndex) => {
          const posture = result.postures[debaterIndex];
          const initialArg = result.initialArguments[debaterIndex];

          return (
            <div key={debaterIndex} className={`flex flex-col ${getColumnColor(debaterIndex)}`}>
              {/* Column Header - Sticky */}
              <div className={`sticky top-0 z-10 px-4 py-3 border-b border-gray-300 ${getHeaderColor(debaterIndex)}`}>
                <div className="text-sm font-bold truncate leading-tight">
                  {posture}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Score: {result.verdict.perDebater[debaterIndex]?.totals.weighted.toFixed(2) || 'N/A'}
                </div>
              </div>

              {/* Messages */}
              <div className="p-4 space-y-4">
                {/* Initial Argument */}
                {initialArg && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-gray-600 mb-2">Initial Argument</div>
                    <div className="prose prose-sm prose-slate max-w-none">
                      {initialArg.perTopic?.map((topic, idx) => (
                        <div key={idx} className="mb-4">
                          <h4 className="text-sm font-bold text-gray-900 mb-1">{topic.topic}</h4>
                          {topic.claim && (
                            <p className="text-sm mb-2">
                              <strong>Claim:</strong> {topic.claim}
                            </p>
                          )}
                          {topic.reasoning && (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {topic.reasoning}
                            </ReactMarkdown>
                          )}
                        </div>
                      ))}
                      {initialArg.overallPosition && (
                        <div className="mt-3 p-2 bg-gray-100 rounded text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {initialArg.overallPosition}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Q&A Rounds */}
                {result.rounds && result.rounds.length > 0 ? (
                  result.rounds.map((round, roundIdx) => (
                    <div key={roundIdx} className="space-y-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase">
                        Round {round.roundNumber}
                      </div>
                      {round.exchanges.map((exchange, exIdx) => {
                        // Only show what THIS debater says
                        const askedQuestion = exchange.fromDebater === posture;
                        const answeredQuestion = exchange.toDebater === posture;

                        return (
                          <div key={exIdx}>
                            {askedQuestion && (
                              <div className="pl-3 border-l-2 border-gray-400 mb-2">
                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                  Question to {exchange.toDebater}:
                                </div>
                                <div className="prose prose-sm prose-slate max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {exchange.question}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                            {answeredQuestion && (
                              <div className="pl-3 border-l-2 border-gray-600 mb-2">
                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                  Response to {exchange.fromDebater}:
                                </div>
                                <div className="prose prose-sm prose-slate max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {exchange.response}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-xs text-yellow-800">
                      ⚠️ No debate rounds found in result data
                    </div>
                  </div>
                )}

                {/* Judge Verdict for this debater */}
                {result.verdict.perDebater[debaterIndex] && (
                  <div className="mt-4 p-3 bg-gray-100 rounded">
                    <div className="text-xs font-semibold text-gray-700 mb-2">Judge Evaluation</div>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="font-medium">Correctness:</span>{' '}
                        {result.verdict.perDebater[debaterIndex].totals.byCriterion.correctness?.toFixed(1) || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Evidence:</span>{' '}
                        {result.verdict.perDebater[debaterIndex].totals.byCriterion.evidence?.toFixed(1) || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Clarity:</span>{' '}
                        {result.verdict.perDebater[debaterIndex].totals.byCriterion.clarity?.toFixed(1) || 'N/A'}
                      </div>
                      <div className="font-bold mt-2">
                        Total: {result.verdict.perDebater[debaterIndex].totals.weighted.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
