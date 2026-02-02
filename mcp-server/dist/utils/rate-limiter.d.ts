/**
 * Rate Limiter for GTM API calls
 *
 * GTM API has quota limits (typically 50 requests/minute/user)
 * This module provides:
 * 1. Proactive throttling - delays requests to stay under quota
 * 2. Backoff on 429 errors - exponential backoff when rate limited
 */
export interface RateLimiterConfig {
    maxRequestsPerMinute: number;
    retryDelayMs: number;
    maxRetries: number;
}
/**
 * Rate Limiter class for managing API request rates
 */
export declare class RateLimiter {
    private requestTimestamps;
    private config;
    constructor(config?: Partial<RateLimiterConfig>);
    /**
     * Throttle requests to stay under rate limit
     * Call this before making an API request
     */
    throttle(): Promise<void>;
    /**
     * Calculate exponential backoff delay for retries
     */
    getBackoffDelay(attempt: number): number;
    /**
     * Get max retries configured
     */
    getMaxRetries(): number;
    /**
     * Check if an error is a rate limit error
     */
    static isRateLimitError(error: any): boolean;
    /**
     * Delay helper
     */
    private delay;
    /**
     * Get current request count (for debugging)
     */
    getCurrentRequestCount(): number;
    /**
     * Reset the rate limiter (useful for testing)
     */
    reset(): void;
}
/**
 * Get the global rate limiter instance
 */
export declare function getRateLimiter(): RateLimiter;
/**
 * Reset the global rate limiter
 */
export declare function resetRateLimiter(): void;
/**
 * Delay helper (exported for use in other modules)
 */
export declare function delay(ms: number): Promise<void>;
