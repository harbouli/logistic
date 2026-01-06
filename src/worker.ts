import dotenv from 'dotenv';
dotenv.config();

import { initializeDatabase } from './config/database';
import { createRouteWorker, createReceiptWorker } from './jobs';

// Import models to register associations
import './models';

async function startWorker(): Promise<void> {
    console.log('🚀 Starting LogistiMa Worker...');

    try {
        // Initialize database connection
        await initializeDatabase();

        // Create workers
        const routeWorker = createRouteWorker();
        const receiptWorker = createReceiptWorker();

        console.log('✅ Workers started successfully');
        console.log('📦 Listening for jobs on queues: route, receipt');

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`\n${signal} received. Shutting down workers...`);

            await routeWorker.close();
            await receiptWorker.close();

            console.log('👋 Workers shut down gracefully');
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        console.error('❌ Failed to start worker:', error);
        process.exit(1);
    }
}

startWorker();
