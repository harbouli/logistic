import { Queue } from 'bullmq';
import { redis } from './redis';

// Queue for route calculation
export const routeQueue = new Queue('route', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});

// Queue for receipt generation
export const receiptQueue = new Queue('receipt', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
    },
});

export async function closeQueues(): Promise<void> {
    await routeQueue.close();
    await receiptQueue.close();
}
