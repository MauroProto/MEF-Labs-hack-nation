/**
 * MAS Debate Viewer
 *
 * Displays debate results from the improved MAS debate system where all debaters
 * argue the SAME topics from DIFFERENT postures (like a real debate).
 */

'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DebateReport, DebaterArgument } from '@/lib/api/masDebateApi';
import { ExternalLink, FileText, Trophy, Lightbulb, AlertCircle } from 'lucide-react';

interface MasDebateViewerProps {
  report: DebateReport;
  arguments?: DebaterArgument[];
}

const POSTURE_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-green-100 text-green-800 border-green-300',
  'bg-orange-100 text-orange-800 border-orange-300',
];

export function MasDebateViewer({ report, arguments: debaterArgs }: MasDebateViewerProps) {
  const [selectedTab, setSelectedTab] = useState("0");

  return (
    <div className="space-y-4">
      {/* Question Header */}
      <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <AlertCircle className="h-5 w-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">Research Question</h3>
            <p className="text-gray-700">{report.question}</p>
          </div>
        </div>
      </Card>

      {/* Topics Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap gap-2 h-auto">
          {report.topics.map((topic, index) => (
            <TabsTrigger
              key={index}
              value={index.toString()}
              className="text-xs sm:text-sm whitespace-normal text-center h-auto py-2 px-2"
            >
              {topic}
            </TabsTrigger>
          ))}
          <TabsTrigger value="verdict" className="text-xs sm:text-sm bg-amber-50 whitespace-normal text-center h-auto py-2 px-2">
            Final Verdict
          </TabsTrigger>
        </TabsList>

        {/* Topic Content */}
        {report.topics.map((topic, topicIndex) => (
          <TabsContent key={topicIndex} value={topicIndex.toString()} className="space-y-4 mt-4">
            {/* Debaters' Arguments for this Topic */}
            <div className="space-y-4">
              {debaterArgs?.map((arg, debaterIndex) => {
                const topicArg = arg.perTopic.find((t) => t.topic === topic);
                if (!topicArg) return null;

                const colorClass = POSTURE_COLORS[debaterIndex % POSTURE_COLORS.length];
                const ranking = report.rankedPostures.find((r) => r.posture === arg.posture);
                const rank = ranking
                  ? report.rankedPostures.indexOf(ranking) + 1
                  : debaterIndex + 1;

                // Find judge scores for this debater and topic
                const debaterVerdict = report.appendix.scoringTable.find(
                  (s) => s.posture === arg.posture
                );
                const topicScore = debaterVerdict?.perTopic.find((t) => t.topic === topic);

                return (
                  <Card key={debaterIndex} className={`p-4 border-2 ${colorClass}`}>
                    {/* Posture Header */}
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className={colorClass}>
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📍'}{' '}
                        {arg.posture}
                      </Badge>
                    </div>

                    {/* Claim */}
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Claim</h4>
                      <p className="text-gray-900">{topicArg.claim}</p>
                    </div>

                    {/* Reasoning */}
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">Reasoning</h4>
                      <p className="text-gray-700 text-sm">{topicArg.reasoning}</p>
                    </div>

                    {/* Evidence */}
                    {(topicArg.cites.paper?.length || topicArg.cites.web?.length) && (
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Evidence</h4>
                        <div className="space-y-2">
                          {topicArg.cites.paper?.slice(0, 2).map((cite: any, i: number) => (
                            <div
                              key={i}
                              className="text-xs bg-white/50 p-2 rounded border border-gray-200"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <FileText className="h-3 w-3 text-gray-500" />
                                <span className="font-medium text-gray-600">
                                  {cite.chunkId}
                                </span>
                                <span className="text-gray-500">
                                  (relevance: {Math.round(cite.score * 100)}%)
                                </span>
                              </div>
                              <p className="text-gray-600 line-clamp-2">
                                {cite.text.substring(0, 150)}...
                              </p>
                            </div>
                          ))}
                          {topicArg.cites.web?.slice(0, 2).map((cite: any, i: number) => (
                            <a
                              key={i}
                              href={cite.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs bg-white/50 p-2 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <ExternalLink className="h-3 w-3 text-blue-500" />
                                <span className="font-medium text-blue-600">{cite.title}</span>
                              </div>
                              <p className="text-gray-600 line-clamp-2">{cite.snippet}</p>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Judge Scores for this Topic */}
                    {topicScore && (
                      <div className="pt-3 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Judge Scores
                        </h4>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          {Object.entries(topicScore.scores).map(([criterion, score]) => (
                            <div key={criterion} className="text-center">
                              <div className="font-medium text-gray-600 capitalize">
                                {criterion}
                              </div>
                              <div className="text-lg font-bold text-gray-900">
                                {score.toFixed(1)}
                              </div>
                            </div>
                          ))}
                        </div>
                        {topicScore.notes && (
                          <p className="text-xs text-gray-600 mt-2 italic">
                            {topicScore.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        ))}

        {/* Final Verdict Tab */}
        <TabsContent value="verdict" className="space-y-4">
          {/* Summary */}
          <Card className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                <p className="text-gray-700 text-sm">{report.summary}</p>
              </div>
            </div>
          </Card>

          {/* Rankings */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h3 className="font-semibold text-gray-900">Ranked Postures</h3>
            </div>
            <div className="space-y-2">
              {report.rankedPostures.map((ranked, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍'}
                    </span>
                    <span className="font-medium text-gray-900">{ranked.posture}</span>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {Math.round(ranked.score * 100)}/100
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Validated Insights */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Validated Insights</h3>
            </div>
            <ul className="space-y-2">
              {report.validatedInsights.map((insight, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Controversial Points */}
          {report.controversialPoints.length > 0 && (
            <Card className="p-4 border-orange-200 bg-orange-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-gray-900">Controversial Points</h3>
              </div>
              <ul className="space-y-2">
                {report.controversialPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-orange-500 mt-0.5">⚠️</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Recommended Readings */}
          {report.recommendedNextReads.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Recommended Next Reads</h3>
              <div className="space-y-2">
                {report.recommendedNextReads.map((read, index) => (
                  <a
                    key={index}
                    href={read.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-blue-600 text-sm">{read.title}</div>
                        <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                          {read.snippet}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Markdown Export */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                const blob = new Blob([report.markdown], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'debate-report.md';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              Export Full Report (Markdown)
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
