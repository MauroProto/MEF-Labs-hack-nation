/**
 * Agent Event Bus
 *
 * EventEmitter-based event bus for agent-to-agent communication.
 * Zero dependencies, type-safe, in-process event handling.
 */

import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import type {
  AgentEvent,
  AgentEventType,
  AgentInvokeEvent,
  AgentResponseEvent,
  AgentRegisteredEvent,
  AgentStatusEvent,
  AgentErrorEvent,
  AgentInvocationRequest,
  JsonRpcResponse,
  AgentMetadata,
  AgentStatus,
} from '../types/agent.types';

/**
 * Type-safe event listener signatures
 */
interface AgentEventBusEvents {
  'agent:invoke': (event: AgentInvokeEvent) => void;
  'agent:response': (event: AgentResponseEvent) => void;
  'agent:broadcast': (event: AgentEvent) => void;
  'agent:registered': (event: AgentRegisteredEvent) => void;
  'agent:deregistered': (event: AgentEvent<{ nodeId: string }>) => void;
  'agent:status': (event: AgentStatusEvent) => void;
  'agent:error': (event: AgentErrorEvent) => void;
}

/**
 * AgentEventBus - Core event system for agent communication
 *
 * Features:
 * - Type-safe event emitting and listening
 * - Auto-correlation IDs for request/response tracking
 * - Event history for debugging
 * - Metrics collection
 */
export class AgentEventBus extends EventEmitter {
  private eventHistory: AgentEvent[] = [];
  private maxHistorySize: number = 1000;
  private metrics: Map<AgentEventType, number> = new Map();

  constructor() {
    super();
    // Support many concurrent agents
    this.setMaxListeners(100);

    // Initialize metrics for all event types
    const eventTypes: AgentEventType[] = [
      'agent:invoke',
      'agent:response',
      'agent:broadcast',
      'agent:registered',
      'agent:deregistered',
      'agent:status',
      'agent:error',
    ];

    eventTypes.forEach((type) => this.metrics.set(type, 0));
  }

  /**
   * Emit an agent invocation request
   */
  public invoke(request: AgentInvocationRequest): void {
    const event: AgentInvokeEvent = {
      type: 'agent:invoke',
      payload: request,
      timestamp: new Date(),
    };

    this.emitAndTrack(event);
  }

  /**
   * Emit an agent response
   */
  public respond(requestId: string, response: JsonRpcResponse): void {
    const event: AgentResponseEvent = {
      type: 'agent:response',
      payload: response,
      timestamp: new Date(),
    };

    this.emitAndTrack(event);
  }

  /**
   * Emit agent registered event
   */
  public registered(agent: AgentMetadata): void {
    const event: AgentRegisteredEvent = {
      type: 'agent:registered',
      payload: agent,
      timestamp: new Date(),
    };

    this.emitAndTrack(event);
  }

  /**
   * Emit agent deregistered event
   */
  public deregistered(nodeId: string): void {
    const event: AgentEvent<{ nodeId: string }> = {
      type: 'agent:deregistered',
      payload: { nodeId },
      timestamp: new Date(),
    };

    this.emitAndTrack(event);
  }

  /**
   * Emit agent status change
   */
  public statusChange(nodeId: string, status: AgentStatus, error?: string): void {
    const event: AgentStatusEvent = {
      type: 'agent:status',
      payload: { nodeId, status, error },
      timestamp: new Date(),
    };

    this.emitAndTrack(event);
  }

  /**
   * Emit agent error
   */
  public error(nodeId: string, error: Error, context?: any): void {
    const event: AgentErrorEvent = {
      type: 'agent:error',
      payload: { nodeId, error, context },
      timestamp: new Date(),
    };

    this.emitAndTrack(event);
  }

  /**
   * Broadcast a message to all listeners
   */
  public broadcast(payload: any): void {
    const event: AgentEvent = {
      type: 'agent:broadcast',
      payload,
      timestamp: new Date(),
    };

    this.emitAndTrack(event);
  }

  /**
   * Type-safe event listener
   */
  public onInvoke(listener: AgentEventBusEvents['agent:invoke']): this {
    return this.on('agent:invoke', listener);
  }

  public onResponse(listener: AgentEventBusEvents['agent:response']): this {
    return this.on('agent:response', listener);
  }

  public onRegistered(listener: AgentEventBusEvents['agent:registered']): this {
    return this.on('agent:registered', listener);
  }

  public onStatus(listener: AgentEventBusEvents['agent:status']): this {
    return this.on('agent:status', listener);
  }

  public onError(listener: AgentEventBusEvents['agent:error']): this {
    return this.on('agent:error', listener);
  }

  public onBroadcast(listener: (event: AgentEvent) => void): this {
    return this.on('agent:broadcast', listener);
  }

  /**
   * Get event history (for debugging)
   */
  public getHistory(limit?: number): AgentEvent[] {
    return limit ? this.eventHistory.slice(-limit) : [...this.eventHistory];
  }

  /**
   * Get metrics
   */
  public getMetrics(): Record<AgentEventType, number> {
    const metrics: Record<string, number> = {};
    this.metrics.forEach((count, type) => {
      metrics[type] = count;
    });
    return metrics as Record<AgentEventType, number>;
  }

  /**
   * Clear history (for memory management)
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics.forEach((_, type) => {
      this.metrics.set(type, 0);
    });
  }

  /**
   * Generate unique request ID
   */
  public static generateRequestId(): string {
    return nanoid();
  }

  /**
   * Private: Emit and track event
   */
  private emitAndTrack(event: AgentEvent): void {
    // Add to history
    this.eventHistory.push(event);

    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Update metrics
    const currentCount = this.metrics.get(event.type) || 0;
    this.metrics.set(event.type, currentCount + 1);

    // Emit the event
    this.emit(event.type, event);
  }
}

// Singleton instance
export const agentBus = new AgentEventBus();
