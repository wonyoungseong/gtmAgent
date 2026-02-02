/**
 * Rate Limiter for GTM API calls
 *
 * GTM API has quota limits (typically 50 requests/minute/user)
 * This module provides:
 * 1. Proactive throttling - delays requests to stay under quota
 * 2. Backoff on 429 errors - exponential backoff when rate limited
 */

export interface RateLimiterConfig {
  maxRequestsPerMinute: number;  // GTM API: 50 requests/minute/user
  retryDelayMs: number;          // Base retry delay
  maxRetries: number;            // Maximum retry attempts
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequestsPerMinute: 45,  // Conservative limit (GTM allows 50)
  retryDelayMs: 1000,
  maxRetries: 5
};

/**
 * Rate Limiter class for managing API request rates
 */
export class RateLimiter {
  private requestTimestamps: number[] = [];
  private config: RateLimiterConfig;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Throttle requests to stay under rate limit
   * Call this before making an API request
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);

    // If at limit, wait until oldest request expires
    if (this.requestTimestamps.length >= this.config.maxRequestsPerMinute) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + 60000 - now + 100; // Extra 100ms buffer

      if (waitTime > 0) {
        console.error(`[GTM MCP] Rate limit approaching, waiting ${waitTime}ms...`);
        await this.delay(waitTime);
      }
    }

    // Record this request
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  getBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, up to max 60s
    return Math.min(
      this.config.retryDelayMs * Math.pow(2, attempt),
      60000
    );
  }

  /**
   * Get max retries configured
   */
  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  /**
   * Check if an error is a rate limit error
   */
  static isRateLimitError(error: any): boolean {
    if (!error) return false;

    const code = error.code || error.response?.status;
    const message = error.message || '';

    return (
      code === 429 ||
      code === '429' ||
      message.includes('Quota exceeded') ||
      message.includes('rate limit') ||
      message.includes('Rate Limit') ||
      message.includes('rateLimitExceeded') ||
      message.includes('userRateLimitExceeded') ||
      message.includes('Queries per minute per user')
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current request count (for debugging)
   */
  getCurrentRequestCount(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    return this.requestTimestamps.filter(t => t > oneMinuteAgo).length;
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  reset(): void {
    this.requestTimestamps = [];
  }
}

// Singleton instance for global rate limiting
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get the global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter
 */
export function resetRateLimiter(): void {
  if (globalRateLimiter) {
    globalRateLimiter.reset();
  }
}

/**
 * Delay helper (exported for use in other modules)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
