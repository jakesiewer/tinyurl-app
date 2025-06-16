import dotenv from 'dotenv';
dotenv.config();

import { NextFunction, Request, Response } from 'express';
import { redisClient } from '../config/redis';
import { RateLimiterRule } from '../types';

export const rateLimiter = (rules: RateLimiterRule[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const matchedRule = rules.find(rule => req.path.startsWith(rule.endpoint));
        if (!matchedRule) {
            return next();
        }
        const { endpoint, rate_limit } = matchedRule;
        const ipAddress = req.ip;
        const redisId = `${endpoint}:${ipAddress}`;

        console.log(`Rate limiting for ${redisId} on endpoint ${endpoint}`);
        console.log(`Rate limit rule: ${JSON.stringify(rate_limit)}`);

        const requests = await redisClient.incr(redisId);
        if (requests === 1) {
            await redisClient.expire(redisId, rate_limit.time);
        } else {
            // Ensure expiration is always set
            const ttl = await redisClient.ttl(redisId);
            if (ttl === -1) {
                await redisClient.expire(redisId, rate_limit.time);
            }
        }
        
        if (requests > rate_limit.limit) {
            return res.status(429).json({
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Try again in ${rate_limit.time} seconds.`
            });
        }
        next();
    };
}

export const config = {
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};
