/**
 * WebSocket Hooks
 *
 * Re-export all WebSocket-related hooks for easier imports.
 */

export { useWebSocket } from './useWebSocket';
export type { UseWebSocketOptions, UseWebSocketReturn, ConnectionState } from './useWebSocket';

export { useAgentEvents, useAgentInvocations } from './useAgentEvents';
export type {
  AgentEventType,
  AgentInvokeEvent,
  AgentResponseEvent,
  AgentRegisteredEvent,
  AgentStatusEvent,
  AgentErrorEvent,
  AgentEventHandlers,
  AgentInvocation,
} from './useAgentEvents';

export { useAgentStatus } from './useAgentStatus';
export type { AgentMetadata, AgentStats } from './useAgentStatus';
