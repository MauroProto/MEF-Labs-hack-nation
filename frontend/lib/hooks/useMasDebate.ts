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
  type DebateProgressEvent,
  type DebateReport,
  type DebaterArgument,
  type JudgeVerdict,
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

  // Debate results (current debate)
  arguments?: DebaterArgument[];
  verdict?: JudgeVerdict;
  report?: DebateReport;

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
    history: [],
  });

  const [loading, setLoading] = useState(false);

  // ====================================================================
  // Step 1: Generate Questions
  // ====================================================================
  const fetchQuestions = useCallback(async (paperId: string) => {
    setLoading(true);
    setDebateState({
      status: 'generating_questions',
      progress: 'Generating research questions from paper...',
    });

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
      setDebateState({
        status: 'error',
        progress: '',
        error: error instanceof Error ? error.message : 'Failed to generate questions',
      });
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
      setDebateState({
        status: 'generating_postures',
        progress: 'Starting debate...',
        selectedQuestion: question,
      });

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
                    }, ...prev.history]
                  : prev.history;

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
            setDebateState({
              status: 'error',
              progress: '',
              error: error.message,
            });
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
      history: prev.history, // Preserve history
    }));
    setLoading(false);
  }, []);

  return {
    debateState,
    loading,
    fetchQuestions,
    fetchPostures,
    runDebate,
    loadDebateFromHistory,
    reset,
  };
}
