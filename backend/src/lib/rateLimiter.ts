/**
 * Rate Limiter
 *
 * Token bucket algorithm for rate limiting agent invocations.
 * Prevents spam and infinite loops in agent communication.
 */

import type { RateLimitConfig, RateLimitStatus } from '../types/agent.types';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per millisecond
}

/**
 * RateLimiter - Token bucket implementation
 *
 * Features:
 * - Per-agent rate limiting
 * - Canvas-wide rate limiting
 * - Automatic token refill
 * - Thread-safe (single process)
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed and consume a token if so
   */
  public consume(key: string): RateLimitStatus {
    const bucket = this.getBucket(key);
    const now = Date.now();

    // Refill tokens based on time elapsed
    this.refillBucket(bucket, now);

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt: this.calculateResetTime(bucket, now),
      };
    }

    // No tokens available
    return {
      allowed: false,
      remaining: 0,
      resetAt: this.calculateResetTime(bucket, now),
    };
  }

  /**
   * Check rate limit status without consuming
   */
  public check(key: string): RateLimitStatus {
    const bucket = this.getBucket(key);
    const now = Date.now();

    // Refill tokens based on time elapsed
    this.refillBucket(bucket, now);

    return {
      allowed: bucket.tokens >= 1,
      remaining: Math.floor(bucket.tokens),
      resetAt: this.calculateResetTime(bucket, now),
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  public reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all rate limits
   */
  public resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Get or create bucket for key
   */
  private getBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      // Calculate refill rate: tokens per millisecond
      const refillRate = this.config.maxRequests / this.config.windowMs;

      bucket = {
        tokens: this.config.maxRequests,
        lastRefill: Date.now(),
        maxTokens: this.config.maxRequests,
        refillRate,
      };

      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillBucket(bucket: TokenBucket, now: number): void {
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = elapsed * bucket.refillRate;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  /**
   * Calculate when bucket will be full again
   */
  private calculateResetTime(bucket: TokenBucket, now: number): Date {
    const tokensNeeded = bucket.maxTokens - bucket.tokens;
    const timeNeeded = tokensNeeded / bucket.refillRate;
    return new Date(now + timeNeeded);
  }

  /**
   * Get current bucket status for debugging
   */
  public getBucketStatus(key: string): {
    tokens: number;
    maxTokens: number;
    refillRate: number;
  } | null {
    const bucket = this.buckets.get(key);
    if (!bucket) return null;

    const now = Date.now();
    this.refillBucket(bucket, now);

    return {
      tokens: bucket.tokens,
      maxTokens: bucket.maxTokens,
      refillRate: bucket.refillRate,
    };
  }
}

/**
 * Pre-configured rate limiters for different scopes
 */
export class AgentRateLimiters {
  // Per-agent limit: 10 requests per minute
  public static readonly perAgent = new RateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  });

  // Per-canvas limit: 50 requests per minute
  public static readonly perCanvas = new RateLimiter({
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
  });

  // Global limit: 200 requests per minute
  public static readonly global = new RateLimiter({
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minute
  });

  /**
   * Check if agent invocation is allowed
   *
   * Checks both per-agent and per-canvas limits
   */
  public static checkInvocation(nodeId: string, canvasId: string): {
    allowed: boolean;
    reason?: string;
    resetAt?: Date;
  } {
    // Check per-agent limit
    const agentLimit = this.perAgent.check(nodeId);
    if (!agentLimit.allowed) {
      return {
        allowed: false,
        reason: `Agent ${nodeId} rate limit exceeded. Resets at ${agentLimit.resetAt}`,
        resetAt: agentLimit.resetAt,
      };
    }

    // Check per-canvas limit
    const canvasLimit = this.perCanvas.check(canvasId);
    if (!canvasLimit.allowed) {
      return {
        allowed: false,
        reason: `Canvas ${canvasId} rate limit exceeded. Resets at ${canvasLimit.resetAt}`,
        resetAt: canvasLimit.resetAt,
      };
    }

    // Check global limit
    const globalLimit = this.global.check('global');
    if (!globalLimit.allowed) {
      return {
        allowed: false,
        reason: `Global rate limit exceeded. Resets at ${globalLimit.resetAt}`,
        resetAt: globalLimit.resetAt,
      };
    }

    return { allowed: true };
  }

  /**
   * Consume rate limit for an invocation
   */
  public static consumeInvocation(nodeId: string, canvasId: string): void {
    this.perAgent.consume(nodeId);
    this.perCanvas.consume(canvasId);
    this.global.consume('global');
  }

  /**
   * Reset all rate limiters (for testing)
   */
  public static resetAll(): void {
    this.perAgent.resetAll();
    this.perCanvas.resetAll();
    this.global.resetAll();
  }
}
