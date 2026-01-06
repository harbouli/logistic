import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { Delivery } from '../models';
import { setTimeout } from 'node:timers/promises';
/**
 * Route Calculation Job Handler
 * 
 * Simulates a complex route calculation that takes ~2 seconds.
 * In a real application, this would call an external routing API
 * like Google Maps, OSRM, or Mapbox.
 */
export function createRouteWorker(): Worker {
    const worker = new Worker(
        'route',
        async (job: Job<{ deliveryId: string }>) => {
            const { deliveryId } = job.data;

            console.log(`🗺️ [Route] Starting calculation for delivery ${deliveryId}`);

            await setTimeout(2000);

            // Generate simulated route
            const waypoints = [
                'Pickup: Boulevard Anfa',
                'Via: Avenue Hassan II',
                'Via: Rue Tarik Ibn Ziad',
                'Delivery: Quartier Gauthier',
            ];

            const estimatedRoute = JSON.stringify({
                waypoints,
                distance: `${(Math.random() * 10 + 2).toFixed(1)} km`,
                duration: `${Math.floor(Math.random() * 30 + 10)} minutes`,
                calculatedAt: new Date().toISOString(),
            });

            // Update delivery with route
            await Delivery.update(
                { estimatedRoute },
                { where: { id: deliveryId } }
            );

            console.log(`✅ [Route] Calculation completed for delivery ${deliveryId}`);

            return { deliveryId, route: estimatedRoute };
        },
        {
            connection: redis,
            concurrency: 5,
        }
    );

    worker.on('completed', (job) => {
        console.log(`🎉 Route job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ Route job ${job?.id} failed:`, err);
    });

    return worker;
}


