import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let isReady = false;

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      // Slow down retries after 5 attempts if Redis service isn't active
      return 15000;
    }
    return Math.min(times * 1000, 5000);
  },
});

redis.on('connect', () => {
  console.log('⚡ [Redis] Connecting to Redis...');
});

redis.on('ready', () => {
  isReady = true;
  console.log('🚀 [Redis] Connected and ready for caching & background queues');
});

redis.on('error', (err) => {
  isReady = false;
  // Non-fatal warning during local development if Redis is not running
  if (err.message.includes('ECONNREFUSED')) {
    // Suppress repetitive stack traces in dev console
    return;
  }
  console.warn('⚠️ [Redis Warning]:', err.message);
});

redis.on('close', () => {
  isReady = false;
});

// Attempt initial connection asynchronously without blocking server boot
redis.connect().catch(() => {
  console.log('ℹ️ [Redis] Running without local Redis instance — falling back to PostgreSQL direct queries');
});

export const isRedisReady = (): boolean => isReady;

export default redis;
