import { Request, Response, NextFunction } from 'express';
import { ShortenUrlRequest, ValidationError } from '../types';

export class ValidationErrorClass extends Error implements ValidationError {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isValidShortCode = (code: string): boolean => {
  if (!code || code.length < 6 || code.length > 8) {
    return false;
  }
  return /^[A-Za-z0-9]+$/.test(code);
};

export const validateShortenRequest = (
  req: Request<{}, {}, ShortenUrlRequest>,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { url } = req.body;

    if (!url) {
      throw new ValidationErrorClass('URL is required', 400);
    }

    if (typeof url !== 'string') {
      throw new ValidationErrorClass('URL must be a string', 400);
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      throw new ValidationErrorClass('URL cannot be empty', 400);
    }

    if (!isValidUrl(trimmedUrl)) {
      throw new ValidationErrorClass('Invalid URL format. URL must start with http:// or https://', 400);
    }

    if (trimmedUrl.length > 2048) {
      throw new ValidationErrorClass('URL is too long (maximum 2048 characters)', 400);
    }

    req.body.url = trimmedUrl;

    next();
  } catch (error) {
    if (error instanceof ValidationErrorClass) {
      res.status(error.statusCode).json({
        error: 'Validation Error',
        message: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      });
    }
  }
};

export const validateShortCode = (
  req: Request<{ code: string }>,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { code } = req.params;

    if (!code) {
      throw new ValidationErrorClass('Short code is required', 400);
    }

    if (!isValidShortCode(code)) {
      throw new ValidationErrorClass('Invalid short code format', 400);
    }

    next();
  } catch (error) {
    if (error instanceof ValidationErrorClass) {
      res.status(error.statusCode).json({
        error: 'Validation Error',
        message: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      });
    }
  }
};

export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove any potentially dangerous characters from string inputs
  const sanitizeString = (str: string): string => {
    return str.replace(/[<>\"']/g, '');
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', error);

  if (error instanceof ValidationErrorClass) {
    res.status(error.statusCode).json({
      error: 'Validation Error',
      message: error.message
    });
  } else {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    });
  }
};