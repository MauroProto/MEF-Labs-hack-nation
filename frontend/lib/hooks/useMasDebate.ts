/**
 * React Hook for MAS (Multi-Agent System) Debate
 *
 * Manages debate state and SSE progress updates for the improved debate system.
 */

import { useState, useCallback } from 'react';
import {
  generateQuestions,
  generatePostures,
  runDebateWithSSE,
  runEnhancedDebateWithSSE,
  type DebateProgressEvent,
  type DebateReport,
  type DebaterArgument,
  type JudgeVerdict,
  type EnhancedDebateReport,
  type DebateRound,
  type QuestionDebateResult,
} from '../api/masDebateApi';

export type DebateStatus =
  | 'idle'
  | 'generating_questions'
  | 'selecting_question'
  | 'generating_postures'
  | 'debating'
  | 'judging'
  | 'generating_report'
  | 'completed'
  | 'error';

export type DebaterProgress = {
  index: number;
  posture: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  argument?: DebaterArgument;
  error?: string;
};

export type DebateHistoryEntry = {
  id: string;
  question: string;
  timestamp: Date;
  postures: string[];
  topics: string[];
  arguments: DebaterArgument[];
  verdict: JudgeVerdict;
  report: DebateReport;
};

export type LiveStreamMessage = {
  type: 'debater' | 'question' | 'response';
  questionIndex: number;  // Which question this message belongs to
  debaterIndex?: number;
  posture?: string;
  fromDebater?: string;
  toDebater?: string;
  roundNumber?: number;
  text: string;
  isComplete: boolean;
};

export type DebateState = {
  status: DebateStatus;
  progress: string;

  // Generated questions
  questions?: string[];
  selectedQuestion?: string;

  // Generated postures and topics
  postures?: string[];
  topics?: string[];

  // Per-debater progress tracking
  debaterProgress: DebaterProgress[];

  // Live streaming messages (real-time text accumulation)
  liveMessages: LiveStreamMessage[];

  // Debate results (current debate - single question)
  arguments?: DebaterArgument[];
  verdict?: JudgeVerdict;
  report?: DebateReport;

  // Enhanced debate results (multiple questions + rounds)
  enhancedReport?: EnhancedDebateReport;
  currentRounds?: DebateRound[];  // Rounds being built in real-time
  currentQuestionIndex?: number;  // Which question is being debated

  // Debate history (completed debates)
  history: DebateHistoryEntry[];

  // Error
  error?: string;
};

export function useMasDebate() {
  const [debateState, setDebateState] = useState<DebateState>({
    status: 'idle',
    progress: '',
    debaterProgress: [],
    liveMessages: [],
    history: [],
  });

  const [loading, setLoading] = useState(false);

  // ====================================================================
  // Step 1: Generate Questions
  // ====================================================================
  const fetchQuestions = useCallback(async (paperId: string) => {
    setLoading(true);
    setDebateState((prev) => ({
      ...prev,
      status: 'generating_questions',
      progress: 'Generating research questions from paper...',
    }));

    try {
      const result = await generateQuestions({ paperId });
      setDebateState((prev) => ({
        ...prev,
        status: 'selecting_question',
        progress: `Generated ${result.questions.length} questions`,
        questions: result.questions,
      }));
      setLoading(false);
      return result.questions;
    } catch (error) {
      setDebateState((prev) => ({
        ...prev,
        status: 'error',
        progress: '',
        error: error instanceof Error ? error.message : 'Failed to generate questions',
      }));
      setLoading(false);
      throw error;
    }
  }, []);

  // ====================================================================
  // Step 2: Generate Postures and Topics for Selected Question
  // ====================================================================
  const fetchPostures = useCallback(
    async (paperId: string, question: string, numPostures: number = 3) => {
      setLoading(true);
      setDebateState((prev) => ({
        ...prev,
        status: 'generating_postures',
        progress: 'Generating debate postures and topics...',
        selectedQuestion: question,
      }));

      try {
        const result = await generatePostures({ paperId, question, numPostures });
        setDebateState((prev) => ({
          ...prev,
          status: 'idle',
          progress: `Generated ${result.postures.length} postures and ${result.topics.length} topics`,
          postures: result.postures,
          topics: result.topics,
        }));
        setLoading(false);
        return result;
      } catch (error) {
        setDebateState((prev) => ({
          ...prev,
          status: 'error',
          progress: '',
          error: error instanceof Error ? error.message : 'Failed to generate postures',
        }));
        setLoading(false);
        throw error;
      }
    },
    []
  );

  // ====================================================================
  // Step 3: Run Debate with SSE Progress Updates
  // ====================================================================
  const runDebate = useCallback(
    async (paperId: string, question: string, numPostures: number = 3) => {
      setLoading(true);
      setDebateState((prev) => ({
        ...prev,
        status: 'generating_postures',
        progress: 'Starting debate...',
        selectedQuestion: question,
      }));

      return new Promise<DebateReport>((resolve, reject) => {
        runDebateWithSSE(
          { paperId, question, numPostures },
          // On Progress
          (event: DebateProgressEvent) => {
            console.log('Debate progress:', event);

            // Update state based on progress stage
            if (event.stage === 'postures_generated') {
              // Initialize debater progress array when postures are generated
              const initialProgress: DebaterProgress[] = event.data.postures.map(
                (posture: string, index: number) => ({
                  index,
                  posture,
                  status: 'idle' as const,
                })
              );

              setDebateState((prev) => ({
                ...prev,
                status: 'debating',
                progress: `Postures generated: ${event.data.postures.join(', ')}`,
                postures: event.data.postures,
                topics: event.data.topics,
                debaterProgress: initialProgress,
              }));
            } else if (event.stage === 'debater_started') {
              // Update specific debater to 'running' status
              setDebateState((prev) => {
                const newProgress = [...prev.debaterProgress];
                const debaterIndex = event.data.debaterIndex;
                newProgress[debaterIndex] = {
                  ...newProgress[debaterIndex],
                  status: 'running',
                };

                const completed = newProgress.filter((d) => d.status === 'complete').length;
                const total = event.data.total;

                return {
                  ...prev,
                  debaterProgress: newProgress,
                  progress: `Debating... (${completed}/${total} complete)`,
                };
              });
            } else if (event.stage === 'debater_complete') {
              // Update specific debater to 'complete' status
              setDebateState((prev) => {
                const newProgress = [...prev.debaterProgress];
                const debaterIndex = event.data.debaterIndex;
                newProgress[debaterIndex] = {
                  ...newProgress[debaterIndex],
                  status: 'complete',
                  argument: event.data.argument,
                };

                const completed = newProgress.filter((d) => d.status === 'complete').length;
                const total = event.data.total;

                return {
                  ...prev,
                  debaterProgress: newProgress,
                  progress: `Debating... (${completed}/${total} complete)`,
                };
              });
            } else if (event.stage === 'debater_error') {
              // Update specific debater to 'error' status
              setDebateState((prev) => {
                const newProgress = [...prev.debaterProgress];
                const debaterIndex = event.data.debaterIndex;
                newProgress[debaterIndex] = {
                  ...newProgress[debaterIndex],
                  status: 'error',
                  error: event.data.error,
                };

                return {
                  ...prev,
                  debaterProgress: newProgress,
                  progress: `Debater ${debaterIndex + 1} encountered an error`,
                };
              });
            } else if (event.stage === 'debate_complete') {
              setDebateState((prev) => ({
                ...prev,
                status: 'judging',
                progress: 'Debate complete, judging arguments...',
                arguments: event.data.arguments,
              }));
            } else if (event.stage === 'judging_complete') {
              setDebateState((prev) => ({
                ...prev,
                status: 'generating_report',
                progress: 'Judging complete, generating report...',
                verdict: event.data.verdict,
              }));
            } else if (event.stage === 'report_complete') {
              setDebateState((prev) => {
                // Only save to history if we have all required data
                const existingHistory = Array.isArray(prev.history) ? prev.history : [];
                const newHistory = prev.verdict && prev.arguments && prev.postures && prev.topics
                  ? [{
                      id: Date.now().toString(),
                      question: prev.selectedQuestion || question,
                      timestamp: new Date(),
                      postures: prev.postures,
                      topics: prev.topics,
                      arguments: prev.arguments,
                      verdict: prev.verdict,
                      report: event.data.report,
                    }, ...existingHistory]
                  : existingHistory;

                return {
                  ...prev,
                  status: 'completed',
                  progress: 'Debate report ready!',
                  report: event.data.report,
                  history: newHistory,
                };
              });
              setLoading(false);
              resolve(event.data.report);
            } else {
              // Generic progress update
              setDebateState((prev) => ({
                ...prev,
                progress: event.stage,
              }));
            }
          },
          // On Complete
          (report: DebateReport) => {
            setDebateState((prev) => ({
              ...prev,
              status: 'completed',
              progress: 'Debate completed successfully!',
              report,
            }));
            setLoading(false);
            resolve(report);
          },
          // On Error
          (error: Error) => {
            setDebateState((prev) => ({
              ...prev,
              status: 'error',
              progress: '',
              error: error.message,
            }));
            setLoading(false);
            reject(error);
          }
        );
      });
    },
    []
  );

  // ====================================================================
  // Load debate from history
  // ====================================================================
  const loadDebateFromHistory = useCallback((historyId: string) => {
    setDebateState((prev) => {
      const entry = prev.history.find((h) => h.id === historyId);
      if (!entry) return prev;

      return {
        ...prev,
        status: 'completed',
        progress: 'Loaded from history',
        selectedQuestion: entry.question,
        postures: entry.postures,
        topics: entry.topics,
        arguments: entry.arguments,
        verdict: entry.verdict,
        report: entry.report,
        debaterProgress: [],
      };
    });
  }, []);

  // ====================================================================
  // Reset State (but preserve history)
  // ====================================================================
  const reset = useCallback(() => {
    setDebateState((prev) => ({
      status: 'idle',
      progress: '',
      debaterProgress: [],
      liveMessages: [],  // Clear live messages on reset
      history: Array.isArray(prev.history) ? prev.history : [], // Preserve history
    }));
    setLoading(false);
  }, []);

  // ====================================================================
  // Run Enhanced Debate (Multiple Questions + Rounds)
  // ====================================================================
  const runEnhancedDebate = useCallback(
    async (
      paperId: string,
      questions: string[],
      numPostures: number = 3,
      numRounds: number = 2
    ): Promise<EnhancedDebateReport> => {
      setLoading(true);
      setDebateState((prev) => ({
        ...prev,
        status: 'debating',
        progress: `Starting enhanced debate with ${questions.length} questions...`,
        debaterProgress: [],
      }));

      return new Promise<EnhancedDebateReport>((resolve, reject) => {
        runEnhancedDebateWithSSE(
          { paperId, questions, numPostures, numRounds },
          // On Progress
          (event: DebateProgressEvent) => {
            console.log('Enhanced Debate Progress:', event.stage, event.data);

            // Question started
            if (event.stage === 'question_debate_started') {
              setDebateState((prev) => ({
                ...prev,
                progress: `Debating question ${event.data.questionIndex + 1}/${event.data.totalQuestions}: ${event.data.question}`,
                currentQuestionIndex: event.data.questionIndex,
              }));
            }

            // Postures generated for current question
            if (event.stage === 'postures_generated') {
              const initialProgress: DebaterProgress[] = event.data.postures.map((p: string, i: number) => ({
                index: i,
                posture: p,
                status: 'idle' as const,
              }));
              setDebateState((prev) => ({
                ...prev,
                postures: event.data.postures,
                topics: event.data.topics,
                debaterProgress: initialProgress,
              }));
            }

            // Debater started
            if (event.stage === 'debater_started') {
              setDebateState((prev) => {
                const newProgress = [...prev.debaterProgress];
                if (newProgress[event.data.debaterIndex]) {
                  newProgress[event.data.debaterIndex].status = 'running';
                }
                // Create new live message for this debater
                const newMessage: LiveStreamMessage = {
                  type: 'debater',
                  questionIndex: prev.currentQuestionIndex ?? 0,
                  debaterIndex: event.data.debaterIndex,
                  posture: event.data.posture,
                  text: '',
                  isComplete: false,
                };
                return { ...prev, debaterProgress: newProgress, liveMessages: [...prev.liveMessages, newMessage] };
              });
            }

            // Debater streaming delta
            if (event.stage === 'debater_stream_delta') {
              setDebateState((prev) => {
                const newMessages = [...prev.liveMessages];
                const messageIndex = newMessages.findIndex(
                  (m) => m.type === 'debater' && m.debaterIndex === event.data.debaterIndex && !m.isComplete
                );
                if (messageIndex !== -1) {
                  newMessages[messageIndex] = {
                    ...newMessages[messageIndex],
                    text: newMessages[messageIndex].text + event.data.delta,
                  };
                }
                return { ...prev, liveMessages: newMessages };
              });
            }

            // Debater complete
            if (event.stage === 'debater_complete') {
              setDebateState((prev) => {
                const newProgress = [...prev.debaterProgress];
                if (newProgress[event.data.debaterIndex]) {
                  newProgress[event.data.debaterIndex] = {
                    ...newProgress[event.data.debaterIndex],
                    status: 'complete',
                    argument: event.data.argument,
                  };
                }
                // Mark live message as complete
                const newMessages = [...prev.liveMessages];
                const messageIndex = newMessages.findIndex(
                  (m) => m.type === 'debater' && m.debaterIndex === event.data.debaterIndex && !m.isComplete
                );
                if (messageIndex !== -1) {
                  newMessages[messageIndex] = { ...newMessages[messageIndex], isComplete: true };
                }
                return { ...prev, debaterProgress: newProgress, liveMessages: newMessages };
              });
            }

            // Initial arguments complete
            if (event.stage === 'initial_arguments_complete') {
              setDebateState((prev) => ({
                ...prev,
                arguments: event.data.arguments,
                progress: 'Initial arguments complete. Starting debate rounds...',
              }));
            }

            // Round started
            if (event.stage === 'round_started') {
              setDebateState((prev) => ({
                ...prev,
                progress: `Round ${event.data.roundNumber}/${event.data.totalRounds} started...`,
              }));
            }

            // Exchange question started
            if (event.stage === 'exchange_question') {
              setDebateState((prev) => {
                const newMessage: LiveStreamMessage = {
                  type: 'question',
                  questionIndex: prev.currentQuestionIndex ?? 0,
                  fromDebater: event.data.fromDebater,
                  toDebater: event.data.toDebater,
                  roundNumber: event.data.roundNumber,
                  text: '',
                  isComplete: false,
                };
                return { ...prev, liveMessages: [...prev.liveMessages, newMessage] };
              });
            }

            // Question streaming delta
            if (event.stage === 'question_stream_delta') {
              setDebateState((prev) => {
                const newMessages = [...prev.liveMessages];
                const messageIndex = newMessages.findIndex(
                  (m) => m.type === 'question' &&
                         m.fromDebater === event.data.fromDebater &&
                         m.roundNumber === event.data.roundNumber &&
                         !m.isComplete
                );
                if (messageIndex !== -1) {
                  newMessages[messageIndex] = {
                    ...newMessages[messageIndex],
                    text: newMessages[messageIndex].text + event.data.delta,
                  };
                }
                return { ...prev, liveMessages: newMessages };
              });
            }

            // Exchange response started
            if (event.stage === 'exchange_response') {
              setDebateState((prev) => {
                // Find the question that this response answers
                // event.data.fromDebater is who is RESPONDING (the responder)
                // We need to find the question asked TO this responder
                const newMessages = [...prev.liveMessages];
                const questionIndex = newMessages.findIndex(
                  (m) => m.type === 'question' &&
                         m.toDebater === event.data.fromDebater &&  // Question TO the responder
                         m.roundNumber === event.data.roundNumber &&
                         !m.isComplete
                );

                let questionerPosture: string | undefined;
                if (questionIndex !== -1) {
                  // Mark question as complete and get who asked it
                  questionerPosture = newMessages[questionIndex].fromDebater;
                  newMessages[questionIndex] = { ...newMessages[questionIndex], isComplete: true };
                }

                // Create response message
                const responseMessage: LiveStreamMessage = {
                  type: 'response',
                  questionIndex: prev.currentQuestionIndex ?? 0,
                  fromDebater: questionerPosture,  // Who ASKED the question
                  toDebater: event.data.fromDebater,  // Who is RESPONDING
                  roundNumber: event.data.roundNumber,
                  text: '',
                  isComplete: false,
                };
                return { ...prev, liveMessages: [...newMessages, responseMessage] };
              });
            }

            // Response streaming delta
            if (event.stage === 'response_stream_delta') {
              setDebateState((prev) => {
                const newMessages = [...prev.liveMessages];
                // event.data.fromDebater is who is RESPONDING
                // Response messages have toDebater = responder
                const messageIndex = newMessages.findIndex(
                  (m) => m.type === 'response' &&
                         m.toDebater === event.data.fromDebater &&  // Match on who is responding
                         m.roundNumber === event.data.roundNumber &&
                         !m.isComplete
                );
                if (messageIndex !== -1) {
                  newMessages[messageIndex] = {
                    ...newMessages[messageIndex],
                    text: newMessages[messageIndex].text + event.data.delta,
                  };
                }
                return { ...prev, liveMessages: newMessages };
              });
            }

            // Round complete - update current rounds
            if (event.stage === 'round_complete') {
              setDebateState((prev) => {
                const existingRounds = prev.currentRounds || [];
                // Mark all responses in this round as complete
                const newMessages = [...prev.liveMessages];
                newMessages.forEach((m, i) => {
                  if (m.roundNumber === event.data.roundNumber && !m.isComplete) {
                    newMessages[i] = { ...m, isComplete: true };
                  }
                });
                return {
                  ...prev,
                  currentRounds: [...existingRounds, {
                    roundNumber: event.data.roundNumber,
                    exchanges: event.data.exchanges,
                  }],
                  liveMessages: newMessages,
                  progress: `Round ${event.data.roundNumber} complete`,
                };
              });
            }

            // Judging
            if (event.stage === 'Judging full debate...') {
              setDebateState((prev) => ({
                ...prev,
                status: 'judging',
                progress: 'Judging the full debate...',
              }));
            }

            // Question debate complete
            if (event.stage === 'question_debate_complete') {
              setDebateState((prev) => ({
                ...prev,
                progress: `Completed question ${event.data.questionIndex + 1}`,
                currentRounds: undefined, // Clear for next question
              }));
            }

            // Generating consolidated report
            if (event.stage === 'Generating consolidated report...') {
              setDebateState((prev) => ({
                ...prev,
                status: 'generating_report',
                progress: 'Generating consolidated report...',
              }));
            }
          },
          // On Complete
          (enhancedReport: EnhancedDebateReport) => {
            console.log('Enhanced Debate Complete:', enhancedReport);
            setDebateState((prev) => ({
              ...prev,
              status: 'completed',
              progress: 'Enhanced debate complete!',
              enhancedReport,
              currentRounds: undefined,
              currentQuestionIndex: undefined,
            }));
            setLoading(false);
            resolve(enhancedReport);
          },
          // On Error
          (error: Error) => {
            console.error('Enhanced Debate Error:', error);
            setDebateState((prev) => ({
              ...prev,
              status: 'error',
              progress: '',
              error: error.message,
            }));
            setLoading(false);
            reject(error);
          }
        );
      });
    },
    [debateState.history]
  );

  return {
    debateState,
    loading,
    fetchQuestions,
    fetchPostures,
    runDebate,
    runEnhancedDebate,  // ← NEW
    loadDebateFromHistory,
    reset,
  };
}
