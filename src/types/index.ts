// src/types/index.ts

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