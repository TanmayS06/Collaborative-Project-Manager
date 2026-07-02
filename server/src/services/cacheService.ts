import { redis, isRedisReady } from '../config/redis';

/**
 * Robust Redis Caching Service with graceful fallback
 * If Redis is unavailable or offline, all cache operations silently pass through
 * without impacting database operations or API requests.
 */

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisReady()) return null;

  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    console.warn(`[Cache Warning] Failed to read key "${key}":`, (err as Error).message);
    return null;
  }
};

export const setCache = async (
  key: string,
  data: any,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> => {
  if (!isRedisReady()) return;

  try {
    const serialized = JSON.stringify(data);
    await redis.setex(key, ttlSeconds, serialized);
  } catch (err) {
    console.warn(`[Cache Warning] Failed to set key "${key}":`, (err as Error).message);
  }
};

export const deleteCache = async (key: string): Promise<void> => {
  if (!isRedisReady()) return;

  try {
    await redis.del(key);
  } catch (err) {
    console.warn(`[Cache Warning] Failed to delete key "${key}":`, (err as Error).message);
  }
};

export const invalidateCachePattern = async (pattern: string): Promise<void> => {
  if (!isRedisReady()) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    console.warn(`[Cache Warning] Failed to invalidate pattern "${pattern}":`, (err as Error).message);
  }
};
