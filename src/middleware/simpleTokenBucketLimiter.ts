import dotenv from 'dotenv';
dotenv.config();
import { NextFunction, Request, Response } from 'express';
import { redisClient } from '../config/redis';
import { TokenBucketRule } from '../types';

export const simpleTokenBucketLimiter = (rules: TokenBucketRule[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const matchedRule = rules.find(rule => req.path.startsWith(rule.endpoint));
    
    if (!matchedRule) {
      return next();
    }

    const client = redisClient.getClient();
    const { endpoint, bucket_size, refill_rate, tokens_per_request = 1 } = matchedRule;
    const ipAddress = req.ip;
    const redisKey = `simple_token_bucket:${endpoint}:${ipAddress}`;
    
    try {
      const currentTime = Date.now() / 1000;
      
      // Get current bucket state
      const bucketData = await client.hmGet(redisKey, ['tokens', 'last_refill']);
      let tokens = parseFloat(bucketData[0] || bucket_size.toString());
      let lastRefill = parseFloat(bucketData[1] || currentTime.toString());
      
      // Calculate tokens to add
      const timeElapsed = currentTime - lastRefill;
      const tokensToAdd = timeElapsed * refill_rate;
      tokens = Math.min(bucket_size, tokens + tokensToAdd);
      
      if (tokens >= tokens_per_request) {
        // Consume tokens
        tokens -= tokens_per_request;
        console.log(`Tokens after consumption: ${tokens}`);
        
        // Update bucket state
        await client.hSet(redisKey, {
          tokens: tokens.toString(),
          last_refill: currentTime.toString()
        });
        await client.expire(redisKey, 3600);
        
        return next();
      } else {
        // Update last_refill time
        await client.hSet(redisKey, {
            tokens: tokens.toString(), 
            last_refill: currentTime.toString()
        }
        );
        await client.expire(redisKey, 3600);
        
        const tokensNeeded = tokens_per_request - tokens;
        const retryAfter = Math.ceil(tokensNeeded / refill_rate);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          retryAfter: retryAfter
        });
      }
    } catch (error) {
      console.error('Simple token bucket rate limiter error:', error);
      return next();
    }
  };
};