'use client';

/**
 * DebateViewer Component
 *
 * Displays a debate session with real-time updates
 */

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebate } from '@/lib/hooks/useDebate';
import type { DebateSession, DebateRound, DebateExchange } from '@/lib/api/debateApi';
import { Loader2, CheckCircle2, XCircle, MessageSquare, Scale } from 'lucide-react';

interface DebateViewerProps {
  sessionId: string;
  onClose?: () => void;
}

export function DebateViewer({ sessionId, onClose }: DebateViewerProps) {
  const { getSession, getLocalSession, loading, error } = useDebate({ autoRefresh: true });
  const [session, setSession] = useState<DebateSession | null>(null);

  useEffect(() => {
    // Try to get from local state first
    const localSession = getLocalSession(sessionId);
    if (localSession) {
      setSession(localSession);
    }

    // Fetch latest from API
    getSession(sessionId)
      .then(setSession)
      .catch(console.error);
  }, [sessionId, getSession, getLocalSession]);

  // Update from local state when it changes
  useEffect(() => {
    const localSession = getLocalSession(sessionId);
    if (localSession) {
      setSession(localSession);
    }
  }, [sessionId, getLocalSession]);

  if (loading && !session) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading debate...</span>
        </div>
      </Card>
    );
  }

  if (error && !session) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-2 text-red-600">
          <XCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="p-8">
        <div className="text-center text-gray-500">Debate not found</div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-purple-600" />
          <div>
            <h2 className="text-xl font-semibold">Academic Debate</h2>
            <p className="text-sm text-gray-500">Session {session.id.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={session.status} />
          {session.currentRound && (
            <Badge variant="outline">Round {session.currentRound}/4</Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="transcript" className="p-4">
        <TabsList>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="postures">Postures</TabsTrigger>
          {session.verdict && <TabsTrigger value="verdict">Verdict</TabsTrigger>}
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="mt-4">
          <ScrollArea className="h-[600px] pr-4">
            {session.transcript?.rounds?.map((round) => (
              <RoundView key={round.id} round={round} postures={session.postures} />
            ))}
            {(!session.transcript || session.transcript.rounds.length === 0) && (
              <div className="text-center text-gray-500 py-8">
                {session.status === 'debating' ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Debate in progress...</p>
                  </>
                ) : (
                  <p>No transcript available yet</p>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* Postures Tab */}
        <TabsContent value="postures" className="mt-4">
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {session.postures.map((posture, index) => (
                <Card key={posture.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-purple-700 font-semibold">D{index + 1}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{posture.perspectiveTemplate}</h3>
                      <p className="text-gray-700 mb-3">{posture.initialPosition}</p>
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-600 mb-1">Focus Areas:</p>
                        <div className="flex flex-wrap gap-1">
                          {posture.topics.map((topic, i) => (
                            <Badge key={i} variant="secondary">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Guiding Questions:</p>
                        <ul className="text-sm space-y-1 list-disc list-inside text-gray-700">
                          {posture.guidingQuestions.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Verdict Tab */}
        {session.verdict && (
          <TabsContent value="verdict" className="mt-4">
            <Card className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <Scale className="h-6 w-6 text-purple-600" />
                <div>
                  <h3 className="text-lg font-semibold">Judge's Verdict</h3>
                  <p className="text-sm text-gray-500">
                    Confidence: {(session.verdict.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-purple-900">{session.verdict.verdict}</p>
              </div>
              <div className="mb-4">
                <h4 className="font-medium mb-2">Reasoning</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{session.verdict.reasoning}</p>
              </div>
              {session.verdict.scores && Object.keys(session.verdict.scores).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Scores</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(session.verdict.scores).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                        <Badge>{value}/10</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    initializing: {
      label: 'Initializing',
      className: 'bg-blue-100 text-blue-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    debating: {
      label: 'In Progress',
      className: 'bg-yellow-100 text-yellow-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    evaluating: {
      label: 'Evaluating',
      className: 'bg-orange-100 text-orange-700',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    completed: {
      label: 'Completed',
      className: 'bg-green-100 text-green-700',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    error: {
      label: 'Error',
      className: 'bg-red-100 text-red-700',
      icon: <XCircle className="h-3 w-3" />,
    },
  };

  const variant = variants[status] || variants.initializing;

  return (
    <Badge className={variant.className}>
      <span className="flex items-center gap-1">
        {variant.icon}
        {variant.label}
      </span>
    </Badge>
  );
}

function RoundView({ round, postures }: { round: DebateRound; postures: any[] }) {
  const getDebaterName = (debaterId: string) => {
    const posture = postures.find((p) => p.debaterId === debaterId);
    return posture?.perspectiveTemplate || debaterId;
  };

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="text-sm">
          Round {round.roundNumber}
        </Badge>
        <span className="text-sm text-gray-500 capitalize">
          {round.roundType.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="space-y-3 pl-4 border-l-2 border-purple-200">
        {round.exchanges?.map((exchange) => (
          <ExchangeView
            key={exchange.id}
            exchange={exchange}
            getDebaterName={getDebaterName}
          />
        ))}
      </div>
    </div>
  );
}

function ExchangeView({
  exchange,
  getDebaterName,
}: {
  exchange: DebateExchange;
  getDebaterName: (id: string) => string;
}) {
  const typeColors = {
    exposition: 'bg-blue-50 border-blue-200',
    question: 'bg-purple-50 border-purple-200',
    answer: 'bg-green-50 border-green-200',
  };

  const typeLabels = {
    exposition: 'Exposition',
    question: 'Question',
    answer: 'Answer',
  };

  return (
    <div className={`p-3 rounded-lg border ${typeColors[exchange.type]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {typeLabels[exchange.type]}
          </Badge>
          <span className="text-sm font-medium">{getDebaterName(exchange.from)}</span>
          {exchange.to && (
            <>
              <span className="text-gray-400">→</span>
              <span className="text-sm font-medium">{getDebaterName(exchange.to)}</span>
            </>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(exchange.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">{exchange.content}</p>
      {exchange.topics && exchange.topics.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {exchange.topics.map((topic, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {topic}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
