import { Request, Response, NextFunction } from 'express';
import { redis, isRedisReady } from '../config/redis';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

// In-memory fallback map if Redis is not running
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

export const rateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, max, message = 'Too many requests, please try again later.' } = options;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Identify client by IP (or auth user ID if available)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${req.baseUrl || req.path}:${ip}`;

    try {
      if (isRedisReady()) {
        const current = await redis.incr(key);

        if (current === 1) {
          // Set TTL on first request
          await redis.expire(key, windowSec);
        }

        const ttl = await redis.ttl(key);

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
        res.setHeader('X-RateLimit-Reset', Date.now() + (ttl > 0 ? ttl * 1000 : windowMs));

        if (current > max) {
          res.status(429).json({ error: message });
          return;
        }

        next();
        return;
      }

      // In-memory fallback
      const now = Date.now();
      const record = memoryStore.get(key);

      if (!record || now > record.expiresAt) {
        memoryStore.set(key, { count: 1, expiresAt: now + windowMs });
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', max - 1);
        next();
        return;
      }

      record.count += 1;
      const remaining = Math.max(0, max - record.count);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', record.expiresAt);

      if (record.count > max) {
        res.status(429).json({ error: message });
        return;
      }

      next();
    } catch (err) {
      console.warn('[RateLimiter Warning] Error evaluating limit:', (err as Error).message);
      // Fail open so legitimate traffic is never blocked by a limiter infrastructure error
      next();
    }
  };
};
