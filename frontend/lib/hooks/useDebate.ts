'use client';

/**
 * useDebate Hook
 *
 * React hook for managing debate sessions and real-time updates
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import {
  startDebate as apiStartDebate,
  getDebateSession as apiGetDebateSession,
  listDebateSessions as apiListDebateSessions,
  type DebateSession,
  type StartDebateRequest,
  type Posture,
  type DebateExchange,
  type DebateRound,
  type JudgeVerdict,
} from '../api/debateApi';

export interface DebateEventPayload {
  sessionId: string;
  [key: string]: any;
}

export interface UseDebateOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useDebate(options: UseDebateOptions = {}) {
  const { autoRefresh = false, refreshInterval = 5000 } = options;

  const [sessions, setSessions] = useState<Map<string, DebateSession>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { socket, on, off } = useWebSocket({ autoConnect: true });
  const refreshIntervalRef = useRef<NodeJS.Timeout>();

  /**
   * Start a new debate session
   */
  const startDebate = useCallback(
    async (request: StartDebateRequest): Promise<{ sessionId: string; postures: Posture[] }> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiStartDebate(request);

        // Fetch full session details
        const session = await apiGetDebateSession(response.sessionId);

        // Update local state
        setSessions((prev) => {
          const next = new Map(prev);
          next.set(session.id, session);
          return next;
        });

        return {
          sessionId: response.sessionId,
          postures: response.postures,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start debate';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Get debate session by ID
   */
  const getSession = useCallback(async (sessionId: string): Promise<DebateSession> => {
    setLoading(true);
    setError(null);

    try {
      const session = await apiGetDebateSession(sessionId);

      // Update local state
      setSessions((prev) => {
        const next = new Map(prev);
        next.set(session.id, session);
        return next;
      });

      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch debate session';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * List all debate sessions
   */
  const listSessions = useCallback(
    async (params?: { status?: string; limit?: number; offset?: number }) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiListDebateSessions(params);

        // Update local state
        setSessions((prev) => {
          const next = new Map(prev);
          result.sessions.forEach((session) => {
            next.set(session.id, session);
          });
          return next;
        });

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to list debate sessions';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Get local session from state
   */
  const getLocalSession = useCallback(
    (sessionId: string): DebateSession | undefined => {
      return sessions.get(sessionId);
    },
    [sessions]
  );

  /**
   * Subscribe to debate WebSocket events
   */
  useEffect(() => {
    if (!socket?.connected) return;

    // Debate initialized
    const handleInitialized = (payload: DebateEventPayload) => {
      console.log('[useDebate] Debate initialized:', payload.sessionId);
      // Refresh session
      if (payload.sessionId) {
        getSession(payload.sessionId).catch(console.error);
      }
    };

    // Postures generated
    const handlePosturesGenerated = (payload: DebateEventPayload) => {
      console.log('[useDebate] Postures generated:', payload.sessionId);
      if (payload.sessionId) {
        setSessions((prev) => {
          const session = prev.get(payload.sessionId);
          if (session) {
            const next = new Map(prev);
            next.set(payload.sessionId, {
              ...session,
              postures: payload.postures || session.postures,
            });
            return next;
          }
          return prev;
        });
      }
    };

    // Round started
    const handleRoundStarted = (payload: DebateEventPayload) => {
      console.log('[useDebate] Round started:', payload);
      if (payload.sessionId) {
        setSessions((prev) => {
          const session = prev.get(payload.sessionId);
          if (session) {
            const next = new Map(prev);
            next.set(payload.sessionId, {
              ...session,
              currentRound: payload.roundNumber,
              status: 'debating',
            });
            return next;
          }
          return prev;
        });
      }
    };

    // Exchange received
    const handleExchange = (payload: DebateEventPayload) => {
      console.log('[useDebate] Exchange:', payload);
      // Optionally update transcript in real-time
      // For now, we'll rely on polling or final fetch
    };

    // Round completed
    const handleRoundCompleted = (payload: DebateEventPayload) => {
      console.log('[useDebate] Round completed:', payload);
      if (payload.sessionId) {
        getSession(payload.sessionId).catch(console.error);
      }
    };

    // Verdict received
    const handleVerdict = (payload: DebateEventPayload) => {
      console.log('[useDebate] Verdict received:', payload);
      if (payload.sessionId) {
        setSessions((prev) => {
          const session = prev.get(payload.sessionId);
          if (session) {
            const next = new Map(prev);
            next.set(payload.sessionId, {
              ...session,
              verdict: payload as unknown as JudgeVerdict,
            });
            return next;
          }
          return prev;
        });
      }
    };

    // Debate completed
    const handleCompleted = (payload: DebateEventPayload) => {
      console.log('[useDebate] Debate completed:', payload.sessionId);
      if (payload.sessionId) {
        setSessions((prev) => {
          const session = prev.get(payload.sessionId);
          if (session) {
            const next = new Map(prev);
            next.set(payload.sessionId, {
              ...session,
              status: 'completed',
              verdict: payload.verdict || session.verdict,
            });
            return next;
          }
          return prev;
        });
        // Fetch final state
        getSession(payload.sessionId).catch(console.error);
      }
    };

    // Debate error
    const handleError = (payload: DebateEventPayload) => {
      console.error('[useDebate] Debate error:', payload);
      if (payload.sessionId) {
        setSessions((prev) => {
          const session = prev.get(payload.sessionId);
          if (session) {
            const next = new Map(prev);
            next.set(payload.sessionId, {
              ...session,
              status: 'error',
            });
            return next;
          }
          return prev;
        });
        setError(payload.error || 'Debate encountered an error');
      }
    };

    // Subscribe to events
    on('debate:initialized', handleInitialized);
    on('debate:postures_generated', handlePosturesGenerated);
    on('debate:round_started', handleRoundStarted);
    on('debate:exchange', handleExchange);
    on('debate:round_completed', handleRoundCompleted);
    on('debate:verdict', handleVerdict);
    on('debate:completed', handleCompleted);
    on('debate:error', handleError);

    // Cleanup
    return () => {
      off('debate:initialized', handleInitialized);
      off('debate:postures_generated', handlePosturesGenerated);
      off('debate:round_started', handleRoundStarted);
      off('debate:exchange', handleExchange);
      off('debate:round_completed', handleRoundCompleted);
      off('debate:verdict', handleVerdict);
      off('debate:completed', handleCompleted);
      off('debate:error', handleError);
    };
  }, [socket?.connected, on, off, getSession]);

  /**
   * Auto-refresh active debates
   */
  useEffect(() => {
    if (!autoRefresh) return;

    refreshIntervalRef.current = setInterval(() => {
      const activeSessions = Array.from(sessions.values()).filter(
        (s) => s.status === 'debating' || s.status === 'evaluating'
      );

      activeSessions.forEach((session) => {
        getSession(session.id).catch(console.error);
      });
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, sessions, getSession]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    sessions: Array.from(sessions.values()),
    loading,
    error,

    // Actions
    startDebate,
    getSession,
    listSessions,
    getLocalSession,
    clearError,
  };
}
