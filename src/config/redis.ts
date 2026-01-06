import Redis from 'ioredis';
import Redlock from 'redlock';
import dotenv from 'dotenv';

dotenv.config();

// Redis client for caching
export const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null, // Required for BullMQ
    retryStrategy: (times) => {
        if (times > 10) {
            console.error('❌ Redis connection failed after 10 retries');
            return null;
        }
        return Math.min(times * 100, 3000);
    },
});

redis.on('connect', () => {
    console.log('✅ Redis connection established');
});

redis.on('error', (error) => {
    console.error('❌ Redis error:', error);
});

// Redlock for distributed locking
export const redlock = new Redlock([redis], {
    driftFactor: 0.01,
    retryCount: 10,
    retryDelay: 200,
    retryJitter: 200,
    automaticExtensionThreshold: 500,
});

redlock.on('error', (error) => {
    console.error('❌ Redlock error:', error);
});

// Lock TTL from environment
export const LOCK_TTL_MS = parseInt(process.env.LOCK_TTL_MS || '5000', 10);

export async function closeRedis(): Promise<void> {
    await redis.quit();
}
