import { Router, Request, Response } from 'express';
import { ShortenUrlRequest, ShortenUrlResponse, UrlData, ErrorResponse, RateLimiterRule } from '../types';
import { redisClient } from '../config/redis';
import { codeGenerator } from '../utils/codeGenerator';
import {
    validateShortenRequest,
    validateShortCode,
    sanitizeInput
} from '../middleware/validation';
import { rateLimiter, config } from '../middleware/rateLimiter';

const router = Router();

const USER_RATE_LIMIT_RULES: RateLimiterRule[] = [
    {
        endpoint: '/shorten',
        rate_limit: {
            time: config.RATE_LIMIT_WINDOW, // in seconds
            limit: config.RATE_LIMIT_MAX_REQUESTS // maximum requests allowed
        }
    },
        {
        endpoint: '/api/stats/:code',
        rate_limit: {
            time: config.RATE_LIMIT_WINDOW,
            limit: config.RATE_LIMIT_MAX_REQUESTS
        }
    },
    {
        endpoint: '/api/delete/:code',
        rate_limit: {
            time: config.RATE_LIMIT_WINDOW,
            limit: config.RATE_LIMIT_MAX_REQUESTS
        }
    }
];

router.get('/health', async (req: Request, res: Response): Promise<void> => {
    try {
        const redisConnected = redisClient.isRedisConnected();

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                redis: redisConnected ? 'connected' : 'disconnected'
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Health check failed'
        });
    }
});

router.post('/shorten',
    sanitizeInput,
    validateShortenRequest,
    rateLimiter([USER_RATE_LIMIT_RULES[0]]),
    async (req: Request<{}, ShortenUrlResponse | ErrorResponse, ShortenUrlRequest>, res: Response): Promise<void> => {
        try {
            const { url } = req.body;
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

            // Generate unique short code
            const code = await codeGenerator.generateUniqueCode();

            // Prepare data to store in Redis
            const urlData: UrlData = {
                originalUrl: url,
                createdAt: new Date().toISOString(),
                clicks: 0
            };

            // Store in Redis with optional expiration (30 days)
            const expireInSeconds = 30 * 24 * 60 * 60; // 30 days
            await redisClient.setUrl(code, JSON.stringify(urlData), expireInSeconds);

            // Generate short URL
            const shortUrl = `${baseUrl}/${code}`;

            // Prepare response
            const response: ShortenUrlResponse = {
                shortUrl,
                originalUrl: url,
                code,
                createdAt: urlData.createdAt
            };

            res.status(201).json(response);

        } catch (error) {
            console.error('Error creating shortened URL:', error);

            const errorResponse: ErrorResponse = {
                error: 'Internal Server Error',
                message: 'Failed to create shortened URL'
            };

            res.status(500).json(errorResponse);
        }
    }
);

router.get('/api/stats/:code',
    validateShortCode,
    rateLimiter([USER_RATE_LIMIT_RULES[1]]),
    async (req: Request<{ code: string }>, res: Response): Promise<void> => {
        try {
            const { code } = req.params;

            // Retrieve URL data from Redis
            const urlDataString = await redisClient.getUrl(code);

            if (!urlDataString) {
                res.status(404).json({
                    error: 'Not Found',
                    message: 'Short URL not found or has expired'
                });
                return;
            }

            // Parse and return statistics
            const urlData: UrlData = JSON.parse(urlDataString);

            res.json({
                code,
                originalUrl: urlData.originalUrl,
                createdAt: urlData.createdAt,
                clicks: urlData.clicks || 0,
                shortUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/${code}`
            });

        } catch (error) {
            console.error('Error fetching URL stats:', error);

            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to fetch URL statistics'
            });
        }
    }
);

router.delete('/api/delete/:code',
    validateShortCode,
    rateLimiter([USER_RATE_LIMIT_RULES[2]]),
    async (req: Request<{ code: string }>, res: Response): Promise<void> => {
        try {
            const { code } = req.params;

            // Check if URL exists
            const exists = await redisClient.urlExists(code);

            if (!exists) {
                res.status(404).json({
                    error: 'Not Found',
                    message: 'Short URL not found'
                });
                return;
            }

            // Delete from Redis
            await redisClient.deleteUrl(code);

            res.json({
                message: 'Short URL deleted successfully',
                code
            });

        } catch (error) {
            console.error('Error deleting URL:', error);

            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to delete short URL'
            });
        }
    }
);

router.get('/:code',
    validateShortCode,
    async (req: Request<{ code: string }>, res: Response): Promise<void> => {
        try {
            const { code } = req.params;

            // Retrieve URL data from Redis
            const urlDataString = await redisClient.getUrl(code);

            if (!urlDataString) {
                res.status(404).json({
                    error: 'Not Found',
                    message: 'Short URL not found or has expired'
                });
                return;
            }

            // Parse stored data
            let urlData: UrlData;
            try {
                urlData = JSON.parse(urlDataString);
            } catch (parseError) {
                console.error('Error parsing URL data:', parseError);
                res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'Invalid URL data format'
                });
                return;
            }

            // Increment click counter (optional)
            urlData.clicks = (urlData.clicks || 0) + 1;

            // Update the data in Redis (fire and forget)
            redisClient.setUrl(code, JSON.stringify(urlData))
                .catch(err => console.error('Error updating click count:', err));

            // Perform 301 redirect
            res.redirect(301, urlData.originalUrl);

        } catch (error) {
            console.error('Error redirecting URL:', error);

            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to redirect to original URL'
            });
        }
    }
);

export default router;