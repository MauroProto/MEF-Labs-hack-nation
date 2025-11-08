'use client';

/**
 * Agent Events Hook
 *
 * Subscribe to agent communication events from the WebSocket server.
 * Provides typed event handlers for all agent event types.
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';

/**
 * Agent event types matching backend
 */
export type AgentEventType =
  | 'agent:invoke'
  | 'agent:response'
  | 'agent:registered'
  | 'agent:deregistered'
  | 'agent:status'
  | 'agent:error';

/**
 * Agent invocation event payload
 */
export interface AgentInvokeEvent {
  requestId: string;
  from: string;
  to: string;
  tool: string;
  args: Record<string, any>;
  timestamp: Date;
}

/**
 * Agent response event payload
 */
export interface AgentResponseEvent {
  requestId: string;
  result?: any;
  error?: {
    code: string;
    message: string;
    data?: any;
  };
  timestamp: Date;
}

/**
 * Agent registered event payload
 */
export interface AgentRegisteredEvent {
  nodeId: string;
  agentType: string;
  name: string;
  capabilities: Array<{
    name: string;
    description: string;
    category: string;
  }>;
  timestamp: Date;
}

/**
 * Agent status event payload
 */
export interface AgentStatusEvent {
  nodeId: string;
  status: 'idle' | 'busy' | 'error';
  error?: string;
  timestamp: Date;
}

/**
 * Agent error event payload
 */
export interface AgentErrorEvent {
  nodeId: string;
  error: {
    message: string;
    stack?: string;
  };
  context?: any;
  timestamp: Date;
}

/**
 * Event handlers
 */
export interface AgentEventHandlers {
  onInvoke?: (event: AgentInvokeEvent) => void;
  onResponse?: (event: AgentResponseEvent) => void;
  onRegistered?: (event: AgentRegisteredEvent) => void;
  onDeregistered?: (event: { nodeId: string; timestamp: Date }) => void;
  onStatus?: (event: AgentStatusEvent) => void;
  onError?: (event: AgentErrorEvent) => void;
}

/**
 * useAgentEvents Hook
 *
 * Usage:
 * ```tsx
 * const { subscribe, unsubscribe } = useAgentEvents({
 *   onInvoke: (event) => {
 *     console.log(`Agent ${event.from} calling ${event.to}.${event.tool}`);
 *   },
 *   onResponse: (event) => {
 *     console.log('Response received:', event.result);
 *   },
 * });
 * ```
 */
export function useAgentEvents(handlers: AgentEventHandlers = {}) {
  const { socket, on, off } = useWebSocket({ autoConnect: false });
  const handlersRef = useRef(handlers);

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  // Subscribe to agent events
  const subscribe = useCallback(() => {
    if (!socket) {
      console.warn('[useAgentEvents] Cannot subscribe: socket not available');
      return;
    }

    const { onInvoke, onResponse, onRegistered, onDeregistered, onStatus, onError } =
      handlersRef.current;

    if (onInvoke) {
      on('agent:invoke', onInvoke);
    }

    if (onResponse) {
      on('agent:response', onResponse);
    }

    if (onRegistered) {
      on('agent:registered', onRegistered);
    }

    if (onDeregistered) {
      on('agent:deregistered', onDeregistered);
    }

    if (onStatus) {
      on('agent:status', onStatus);
    }

    if (onError) {
      on('agent:error', onError);
    }

    console.log('[useAgentEvents] Subscribed to agent events');
  }, [socket, on]);

  // Unsubscribe from agent events
  const unsubscribe = useCallback(() => {
    if (!socket) {
      return;
    }

    const { onInvoke, onResponse, onRegistered, onDeregistered, onStatus, onError } =
      handlersRef.current;

    if (onInvoke) {
      off('agent:invoke', onInvoke);
    }

    if (onResponse) {
      off('agent:response', onResponse);
    }

    if (onRegistered) {
      off('agent:registered', onRegistered);
    }

    if (onDeregistered) {
      off('agent:deregistered', onDeregistered);
    }

    if (onStatus) {
      off('agent:status', onStatus);
    }

    if (onError) {
      off('agent:error', onError);
    }

    console.log('[useAgentEvents] Unsubscribed from agent events');
  }, [socket, off]);

  // Auto-subscribe when socket is available
  useEffect(() => {
    if (socket?.connected) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [socket?.connected, subscribe, unsubscribe]);

  return {
    subscribe,
    unsubscribe,
  };
}

/**
 * useAgentInvocations Hook
 *
 * Track agent invocations with request/response correlation.
 *
 * Usage:
 * ```tsx
 * const { invocations, addInvocation, updateInvocation } = useAgentInvocations();
 * ```
 */
export interface AgentInvocation {
  requestId: string;
  from: string;
  to: string;
  tool: string;
  args: Record<string, any>;
  status: 'pending' | 'completed' | 'error';
  result?: any;
  error?: any;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export function useAgentInvocations() {
  const [invocations, setInvocations] = useState<Map<string, AgentInvocation>>(new Map());

  const addInvocation = useCallback((event: AgentInvokeEvent) => {
    setInvocations((prev) => {
      const next = new Map(prev);
      next.set(event.requestId, {
        requestId: event.requestId,
        from: event.from,
        to: event.to,
        tool: event.tool,
        args: event.args,
        status: 'pending',
        startTime: new Date(event.timestamp),
      });
      return next;
    });
  }, []);

  const updateInvocation = useCallback((event: AgentResponseEvent) => {
    setInvocations((prev) => {
      const next = new Map(prev);
      const invocation = next.get(event.requestId);

      if (invocation) {
        const endTime = new Date(event.timestamp);
        const duration = endTime.getTime() - invocation.startTime.getTime();

        next.set(event.requestId, {
          ...invocation,
          status: event.error ? 'error' : 'completed',
          result: event.result,
          error: event.error,
          endTime,
          duration,
        });
      }

      return next;
    });
  }, []);

  const clearInvocations = useCallback(() => {
    setInvocations(new Map());
  }, []);

  const getInvocation = useCallback(
    (requestId: string) => {
      return invocations.get(requestId);
    },
    [invocations]
  );

  const getAllInvocations = useCallback(() => {
    return Array.from(invocations.values());
  }, [invocations]);

  const getPendingInvocations = useCallback(() => {
    return Array.from(invocations.values()).filter((inv) => inv.status === 'pending');
  }, [invocations]);

  // Subscribe to events
  useAgentEvents({
    onInvoke: addInvocation,
    onResponse: updateInvocation,
  });

  return {
    invocations,
    addInvocation,
    updateInvocation,
    clearInvocations,
    getInvocation,
    getAllInvocations,
    getPendingInvocations,
  };
}
