export interface ShortenUrlRequest {
  url: string;
}

export interface ShortenUrlResponse {
  shortUrl: string;
  originalUrl: string;
  code: string;
  createdAt: string;
}

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
}

export interface UrlData {
  originalUrl: string;
  createdAt: string;
  clicks?: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface ValidationError extends Error {
  statusCode: number;
}

export interface RateLimiterRule {
    endpoint: string;
    rate_limit: {
        time: number;
        limit: number;
    }
}

export interface TokenBucketRule {
  endpoint: string;
  bucket_size: number;
  refill_rate: number;
  tokens_per_request: number;
}