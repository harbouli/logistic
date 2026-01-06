import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { initializeDatabase } from './config/database';
import { redis, closeRedis } from './config/redis';
import { closeQueues } from './config/queues';
import { createBullBoardAdapter } from './config/bullBoard';
import { setupZoneCacheHooks } from './services';
import routes from './routes';

// Import models to register associations
import './models';

const app: express.Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Bull Board - Queue Dashboard UI
const bullBoardAdapter = createBullBoardAdapter();
app.use('/admin/queues', bullBoardAdapter.getRouter());

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
    });
});

// Start server
async function startServer(): Promise<void> {
    try {
        // Initialize database
        await initializeDatabase();

        // Setup zone cache hooks
        setupZoneCacheHooks();

        // Start listening
        app.listen(PORT, () => {
            console.log(`🚀 LogistiMa API running on port ${PORT}`);
            console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
            console.log(`📊 Queue Dashboard: http://localhost:${PORT}/admin/queues`);
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);

            await closeQueues();
            await closeRedis();

            console.log('👋 Server shut down gracefully');
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Export for testing
export { app };

// Start if not in test mode
if (process.env.NODE_ENV !== 'test') {
    startServer();
}
