/**
 * Agent Communication Types
 *
 * Defines the type system for MCP-like agent communication protocol
 */

import { z } from 'zod';

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.record(z.any()),
  id: z.string(),
});

export const JsonRpcSuccessResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.any(),
  id: z.string(),
});

export const JsonRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional(),
  }),
  id: z.string(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcSuccessResponse = z.infer<typeof JsonRpcSuccessResponseSchema>;
export type JsonRpcErrorResponse = z.infer<typeof JsonRpcErrorResponseSchema>;
export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

// ============================================================================
// Source & Citation Types
// ============================================================================

export interface Source {
  type: 'paper' | 'web' | 'citation' | 'internal';
  title: string;
  url?: string;
  citation?: string;
  snippet?: string;
  relevance: number; // 0-1
}

export interface ReasoningStep {
  step: number;
  thought: string;
  evidence: Source[];
  confidence: number; // 0-1
}

// ============================================================================
// Agent Tool Schema Types
// ============================================================================

export interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolSchema {
  name: string;
  description: string;
  category: 'analysis' | 'search' | 'validation' | 'synthesis' | 'question';
  inputSchema: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  outputSchema: {
    type: 'object';
    properties: Record<string, any>;
  };
  examples?: Array<{
    input: Record<string, any>;
    output: Record<string, any>;
  }>;
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentType =
  | 'researcher'
  | 'critic'
  | 'synthesizer'
  | 'question_generator'
  | 'citation_tracker'
  | 'web_research';

export type AgentStatus = 'idle' | 'working' | 'error';

export interface AgentMetadata {
  id: string;
  nodeId: string;
  agentType: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: ToolSchema[];
  status: AgentStatus;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Agent Invocation Types
// ============================================================================

export interface AgentInvocationParams {
  from: string; // Invoker agent nodeId
  to: string; // Target agent nodeId
  tool: string; // Tool name
  args: Record<string, any>; // Tool arguments
  context?: Record<string, any>; // Shared context from canvas
  timeout?: number; // ms (default: 30000)
}

export interface AgentInvocationRequest extends JsonRpcRequest {
  method: 'agent.invoke';
  params: AgentInvocationParams;
}

export interface AgentInvocationResult {
  success: boolean;
  data: any;
  metadata: {
    agentId: string;
    toolName: string;
    duration: number; // ms
    confidence: number; // 0-1
    sources: Source[];
    reasoning?: ReasoningStep[];
  };
}

export interface AgentInvocationResponse extends JsonRpcSuccessResponse {
  result: AgentInvocationResult;
}

// ============================================================================
// Agent Event Types
// ============================================================================

export type AgentEventType =
  | 'agent:invoke'
  | 'agent:response'
  | 'agent:broadcast'
  | 'agent:registered'
  | 'agent:deregistered'
  | 'agent:status'
  | 'agent:error';

export interface AgentEvent<T = any> {
  type: AgentEventType;
  payload: T;
  timestamp: Date;
}

export interface AgentInvokeEvent extends AgentEvent<AgentInvocationRequest> {
  type: 'agent:invoke';
}

export interface AgentResponseEvent extends AgentEvent<JsonRpcResponse> {
  type: 'agent:response';
}

export interface AgentRegisteredEvent extends AgentEvent<AgentMetadata> {
  type: 'agent:registered';
}

export interface AgentStatusEvent
  extends AgentEvent<{ nodeId: string; status: AgentStatus; error?: string }> {
  type: 'agent:status';
}

export interface AgentErrorEvent
  extends AgentEvent<{ nodeId: string; error: Error; context?: any }> {
  type: 'agent:error';
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  maxRequests: number; // Maximum requests per window
  windowMs: number; // Time window in milliseconds
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

export interface InvocationContext {
  requestId: string;
  callStack: Set<string>; // nodeIds in current call chain
  startTime: Date;
  timeout: number;
}

export interface CachedResult {
  result: AgentInvocationResult;
  cachedAt: Date;
  expiresAt: Date;
}

// ============================================================================
// Error Codes (JSON-RPC 2.0 standard + custom)
// ============================================================================

export enum ErrorCode {
  // Standard JSON-RPC 2.0 errors
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // Custom agent errors (in -32000 to -32099 range for server errors)
  AgentNotFound = -32001,
  ToolNotFound = -32002,
  CircularDependency = -32003,
  Timeout = -32004,
  RateLimitExceeded = -32005,
  AgentBusy = -32006,
  ValidationFailed = -32007,
}

export class AgentError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'AgentError';
  }

  toJsonRpcError(id: string): JsonRpcErrorResponse {
    return {
      jsonrpc: '2.0',
      error: {
        code: this.code,
        message: this.message,
        data: this.data,
      },
      id,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isJsonRpcRequest(obj: any): obj is JsonRpcRequest {
  return JsonRpcRequestSchema.safeParse(obj).success;
}

export function isJsonRpcSuccessResponse(obj: any): obj is JsonRpcSuccessResponse {
  return JsonRpcSuccessResponseSchema.safeParse(obj).success;
}

export function isJsonRpcErrorResponse(obj: any): obj is JsonRpcErrorResponse {
  return JsonRpcErrorResponseSchema.safeParse(obj).success;
}

export function isAgentInvocationRequest(obj: any): obj is AgentInvocationRequest {
  return isJsonRpcRequest(obj) && obj.method === 'agent.invoke';
}
