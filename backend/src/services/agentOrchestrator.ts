/**
 * Agent Orchestrator
 *
 * Coordinates agent-to-agent invocations with:
 * - Circular dependency detection
 * - Timeout management
 * - Result caching
 * - Retry logic
 * - Rate limiting integration
 */

import { LRUCache } from 'lru-cache';
import { agentBus } from './agentEventBus';
import { AgentRateLimiters } from '../lib/rateLimiter';
import {
  AgentInvocationRequest,
  AgentInvocationResult,
  JsonRpcResponse,
  InvocationContext,
  CachedResult,
  AgentError,
  ErrorCode,
  AgentInvocationParams,
} from '../types/agent.types';

/**
 * AgentOrchestrator - Coordinates agent communication
 *
 * Key responsibilities:
 * 1. Route invocations between agents
 * 2. Prevent circular dependencies
 * 3. Manage timeouts
 * 4. Cache results
 * 5. Handle retries
 */
export class AgentOrchestrator {
  private activeInvocations: Map<string, InvocationContext> = new Map();
  private resultCache: LRUCache<string, CachedResult>;
  private readonly defaultTimeout = 30000; // 30 seconds
  private readonly maxRetries = 3;
  private readonly maxCallDepth = 5;

  constructor() {
    // Initialize LRU cache for results
    this.resultCache = new LRUCache<string, CachedResult>({
      max: 100, // Maximum 100 cached results
      ttl: 1000 * 60 * 5, // 5 minutes TTL
      updateAgeOnGet: true,
    });

    // Listen for agent responses
    agentBus.onResponse((event) => {
      this.handleResponse(event.payload);
    });
  }

  /**
   * Invoke an agent's tool
   *
   * This is the main entry point for agent-to-agent communication
   */
  public async invoke(params: AgentInvocationParams): Promise<AgentInvocationResult> {
    const requestId = agentBus.constructor.generateRequestId();
    const timeout = params.timeout || this.defaultTimeout;

    // Create invocation context
    const context: InvocationContext = {
      requestId,
      callStack: new Set([params.from]),
      startTime: new Date(),
      timeout,
    };

    // Store active invocation
    this.activeInvocations.set(requestId, context);

    try {
      // 1. Check for circular dependencies
      this.checkCircularDependency(params.from, params.to, context);

      // 2. Check call depth
      if (context.callStack.size > this.maxCallDepth) {
        throw new AgentError(
          ErrorCode.CircularDependency,
          `Maximum call depth of ${this.maxCallDepth} exceeded`,
          { callStack: Array.from(context.callStack) }
        );
      }

      // 3. Check rate limits
      const canvasId = params.context?.canvasId || 'default';
      const rateLimitCheck = AgentRateLimiters.checkInvocation(params.to, canvasId);

      if (!rateLimitCheck.allowed) {
        throw new AgentError(ErrorCode.RateLimitExceeded, rateLimitCheck.reason || 'Rate limit exceeded', {
          resetAt: rateLimitCheck.resetAt,
        });
      }

      // 4. Check cache
      const cacheKey = this.getCacheKey(params);
      const cached = this.resultCache.get(cacheKey);

      if (cached && !this.isCacheExpired(cached)) {
        console.log(`[Orchestrator] Cache hit for ${params.tool} on ${params.to}`);
        return cached.result;
      }

      // 5. Consume rate limit
      AgentRateLimiters.consumeInvocation(params.to, canvasId);

      // 6. Create invocation request
      const request: AgentInvocationRequest = {
        jsonrpc: '2.0',
        method: 'agent.invoke',
        params,
        id: requestId,
      };

      // 7. Emit invocation event
      agentBus.invoke(request);

      // 8. Wait for response with timeout
      const result = await this.waitForResponse(requestId, timeout);

      // 9. Cache successful results
      if (result.success) {
        this.cacheResult(cacheKey, result);
      }

      return result;
    } catch (error) {
      // Emit error event
      agentBus.error(params.to, error as Error, { requestId, params });

      // Re-throw
      throw error;
    } finally {
      // Cleanup
      this.activeInvocations.delete(requestId);
    }
  }

  /**
   * Invoke with retry logic
   */
  public async invokeWithRetry(
    params: AgentInvocationParams,
    retries: number = this.maxRetries
  ): Promise<AgentInvocationResult> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < retries) {
      try {
        return await this.invoke(params);
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Don't retry on certain errors
        if (error instanceof AgentError) {
          if (
            error.code === ErrorCode.CircularDependency ||
            error.code === ErrorCode.AgentNotFound ||
            error.code === ErrorCode.ToolNotFound ||
            error.code === ErrorCode.RateLimitExceeded
          ) {
            throw error; // Don't retry these
          }
        }

        // Exponential backoff
        if (attempt < retries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`[Orchestrator] Retry ${attempt}/${retries} after ${backoff}ms`);
          await this.sleep(backoff);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Broadcast a message to all agents
   */
  public broadcast(payload: any): void {
    agentBus.broadcast(payload);
  }

  /**
   * Get active invocation count
   */
  public getActiveInvocations(): number {
    return this.activeInvocations.size;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.resultCache.size,
      hits: this.resultCache.calculatedSize || 0,
      misses: 0, // LRUCache doesn't track misses directly
    };
  }

  /**
   * Clear result cache
   */
  public clearCache(): void {
    this.resultCache.clear();
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependency(from: string, to: string, context: InvocationContext): void {
    if (context.callStack.has(to)) {
      const chain = Array.from(context.callStack);
      chain.push(to);

      throw new AgentError(ErrorCode.CircularDependency, 'Circular dependency detected in agent call chain', {
        chain,
      });
    }

    // Add to call stack
    context.callStack.add(to);
  }

  /**
   * Wait for agent response with timeout
   */
  private waitForResponse(requestId: string, timeout: number): Promise<AgentInvocationResult> {
    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout;
      let resolved = false;

      const responseHandler = (event: any) => {
        const response = event.payload as JsonRpcResponse;

        if (response.id === requestId) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutHandle);

            if ('error' in response) {
              reject(
                new AgentError(response.error.code, response.error.message, response.error.data)
              );
            } else {
              resolve(response.result as AgentInvocationResult);
            }
          }
        }
      };

      // Listen for response
      agentBus.onResponse(responseHandler);

      // Set timeout
      timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          agentBus.removeListener('agent:response', responseHandler);
          reject(new AgentError(ErrorCode.Timeout, `Agent invocation timed out after ${timeout}ms`, { requestId }));
        }
      }, timeout);
    });
  }

  /**
   * Handle response event
   */
  private handleResponse(response: JsonRpcResponse): void {
    // Response handling is done in waitForResponse via event listener
    // This method can be used for additional processing if needed
  }

  /**
   * Generate cache key from invocation params
   */
  private getCacheKey(params: AgentInvocationParams): string {
    // Create deterministic key from params
    const keyData = {
      to: params.to,
      tool: params.tool,
      args: JSON.stringify(params.args),
      // Don't include 'from' so same tool call from different agents hits cache
    };

    return JSON.stringify(keyData);
  }

  /**
   * Check if cached result is expired
   */
  private isCacheExpired(cached: CachedResult): boolean {
    return new Date() > cached.expiresAt;
  }

  /**
   * Cache a successful result
   */
  private cacheResult(key: string, result: AgentInvocationResult): void {
    const cached: CachedResult = {
      result,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };

    this.resultCache.set(key, cached);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const orchestrator = new AgentOrchestrator();
