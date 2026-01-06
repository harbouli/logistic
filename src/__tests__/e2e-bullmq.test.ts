import request from 'supertest';
import { Op } from 'sequelize';
import { app } from '../app';
import sequelize from '../config/database';
import { redis } from '../config/redis';
import { routeQueue, receiptQueue } from '../config/queues';
import { Zone, Driver, Parcel, Delivery } from '../models';
import { createRouteWorker } from '../jobs/routeCalculation';
import { createReceiptWorker } from '../jobs/receiptGeneration';
import { Worker } from 'bullmq';

/**
 * E2E STRESS TEST: BullMQ Queue Processing
 * 
 * Tests the complete dispatch → queue → worker pipeline with 50 simultaneous dispatches.
 */
describe('E2E Stress Test - BullMQ Queue Processing', () => {
    let zone: Zone;
    let drivers: Driver[];
    let parcels: Parcel[];
    let routeWorker: Worker;
    let receiptWorker: Worker;

    beforeAll(async () => {
        // Initialize database
        await sequelize.sync({ force: true });

        // Create test zone
        zone = await Zone.create({
            name: 'BullMQ Test Zone',
            centerLat: 33.5600,
            centerLng: -7.6200,
            radius: 10.0,
        });

        // Start workers for processing jobs
        routeWorker = createRouteWorker();
        receiptWorker = createReceiptWorker();

        console.log('✅ E2E Test setup complete');
    });

    beforeEach(async () => {
        // Clean up previous test data
        await Delivery.destroy({ where: {} });
        await Parcel.destroy({ where: {} });
        await Driver.destroy({ where: {} });

        // Flush Redis locks
        const keys = await redis.keys('lock:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }

        // Obliterate the queues to start fresh (removes ALL jobs)
        await routeQueue.obliterate({ force: true });
        await receiptQueue.obliterate({ force: true });

        // Create 50 drivers, each with capacity=1
        drivers = await Promise.all(
            Array(50)
                .fill(null)
                .map((_, i) =>
                    Driver.create({
                        name: `Driver ${i + 1}`,
                        phone: `+21260000${String(i).padStart(4, '0')}`,
                        latitude: 33.5600 + (Math.random() - 0.5) * 0.02,
                        longitude: -7.6200 + (Math.random() - 0.5) * 0.02,
                        capacity: 1,
                        zoneId: zone.id,
                    })
                )
        );

        // Create 50 parcels
        parcels = await Promise.all(
            Array(50)
                .fill(null)
                .map((_, i) =>
                    Parcel.create({
                        pickupAddress: `Pickup Location ${i + 1}`,
                        pickupLat: 33.5600 + Math.random() * 0.01,
                        pickupLng: -7.6200 + Math.random() * 0.01,
                        deliveryAddress: `Delivery Location ${i + 1}`,
                        deliveryLat: 33.5700 + Math.random() * 0.01,
                        deliveryLng: -7.6100 + Math.random() * 0.01,
                        weight: 1.0 + Math.random() * 5,
                        zoneId: zone.id,
                    })
                )
        );

        console.log(`\n📦 Created ${drivers.length} drivers and ${parcels.length} parcels`);
    });

    afterAll(async () => {
        // Clean shutdown
        await routeWorker.close();
        await receiptWorker.close();
        await routeQueue.close();
        await receiptQueue.close();
        await sequelize.close();
        await redis.quit();
    });

    /**
     * Utility function to wait for queue jobs to complete
     */
    async function waitForQueueCompletion(
        queue: typeof routeQueue,
        expectedCount: number,
        timeoutMs: number = 120000
    ): Promise<{ completed: number; failed: number }> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const counts = await queue.getJobCounts();
            const processed = counts.completed + counts.failed;

            if (processed >= expectedCount) {
                return { completed: counts.completed, failed: counts.failed };
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const finalCounts = await queue.getJobCounts();
        return { completed: finalCounts.completed, failed: finalCounts.failed };
    }

    it('should dispatch 50 parcels SIMULTANEOUSLY and verify BullMQ processing', async () => {
        console.log('\n🔥 SIMULTANEOUS DISPATCH TEST: Sending 50 requests at once...\n');

        const dispatchStartTime = Date.now();

        // Step 1: Dispatch all 50 parcels SIMULTANEOUSLY using Promise.all
        const results = await Promise.all(
            parcels.map((parcel, index) =>
                request(app)
                    .post(`/api/parcels/${parcel.id}/dispatch`)
                    .send({ driverId: drivers[index].id })
                    .catch((err) => ({
                        status: 500,
                        body: { error: err.message },
                    }))
            )
        );

        const dispatchDuration = Date.now() - dispatchStartTime;

        // Step 2: Analyze dispatch results
        const successes = results.filter((r) => r.status === 201);
        const conflicts = results.filter((r) => r.status === 409);
        const errors = results.filter((r) => r.status === 500);

        console.log('📊 SIMULTANEOUS DISPATCH RESULTS:');
        console.log(`   ✅ Successes (201): ${successes.length}`);
        console.log(`   ⚠️  Conflicts (409): ${conflicts.length}`);
        console.log(`   ❌ Errors (500): ${errors.length}`);
        console.log(`   ⏱️  Duration: ${dispatchDuration}ms`);

        // With 50 simultaneous dispatches, expect SOME to succeed
        // (conflicts are normal due to SERIALIZABLE isolation)
        expect(successes.length).toBeGreaterThan(0);
        expect(successes.length + conflicts.length + errors.length).toBe(50);

        // Step 3: Wait for route jobs to complete for successful dispatches
        if (successes.length > 0) {
            console.log(`\n⏳ Waiting for ${successes.length} route jobs to complete...`);
            const routeResults = await waitForQueueCompletion(routeQueue, successes.length);

            console.log(`\n📊 ROUTE JOBS: ${routeResults.completed} completed, ${routeResults.failed} failed`);
            expect(routeResults.completed).toBeGreaterThanOrEqual(successes.length);
        }

        // Step 4: Verify deliveries were created
        const deliveryCount = await Delivery.count();
        console.log(`\n📦 Total deliveries created: ${deliveryCount}`);
        expect(deliveryCount).toBe(successes.length);

        console.log('\n' + '='.repeat(50));
        console.log('✅ SIMULTANEOUS DISPATCH TEST PASSED!');
        console.log('='.repeat(50) + '\n');
    }, 120000);

    it('should dispatch 50 parcels SEQUENTIALLY and verify all BullMQ jobs process', async () => {
        console.log('\n🔥 SEQUENTIAL DISPATCH TEST: Sending 50 requests one-by-one...\n');

        const dispatchStartTime = Date.now();
        let successCount = 0;

        // Step 1: Dispatch parcels SEQUENTIALLY
        for (let i = 0; i < 50; i++) {
            const result = await request(app)
                .post(`/api/parcels/${parcels[i].id}/dispatch`)
                .send({ driverId: drivers[i].id });

            if (result.status === 201) successCount++;
        }

        const dispatchDuration = Date.now() - dispatchStartTime;

        console.log('📊 SEQUENTIAL DISPATCH RESULTS:');
        console.log(`   ✅ Successes: ${successCount}/50`);
        console.log(`   ⏱️  Duration: ${dispatchDuration}ms`);

        // Sequential dispatch should succeed for all 50
        expect(successCount).toBe(50);

        // Step 2: Wait for route jobs to complete
        console.log('\n⏳ Waiting for 50 route jobs to complete...');
        const routeResults = await waitForQueueCompletion(routeQueue, 50);

        console.log(`📊 ROUTE JOBS: ${routeResults.completed} completed, ${routeResults.failed} failed`);
        expect(routeResults.completed).toBeGreaterThanOrEqual(50);
        expect(routeResults.failed).toBe(0);

        // Step 3: Wait for receipt jobs
        console.log('\n⏳ Waiting for 50 receipt jobs to complete...');
        const receiptResults = await waitForQueueCompletion(receiptQueue, 50);

        console.log(`📊 RECEIPT JOBS: ${receiptResults.completed} completed, ${receiptResults.failed} failed`);
        expect(receiptResults.completed).toBeGreaterThanOrEqual(50);

        // Step 4: Verify all deliveries have routes calculated
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const deliveriesWithRoutes = await Delivery.count({
            where: {
                estimatedRoute: {
                    [Op.ne]: null,
                },
            },
        });

        console.log(`\n📦 Deliveries with routes: ${deliveriesWithRoutes}/50`);
        expect(deliveriesWithRoutes).toBe(50);

        // Step 5: Verify all drivers are busy
        const busyDrivers = await Driver.count({ where: { status: 'busy' } });
        expect(busyDrivers).toBe(50);

        const totalTime = Date.now() - dispatchStartTime;
        console.log('\n' + '='.repeat(50));
        console.log('✅ SEQUENTIAL DISPATCH TEST PASSED!');
        console.log(`   📦 Parcels: 50/50`);
        console.log(`   🗺️  Routes: ${deliveriesWithRoutes}`);
        console.log(`   🧾 Receipts: ${receiptResults.completed}`);
        console.log(`   ⏱️  Total: ${totalTime}ms`);
        console.log('='.repeat(50) + '\n');
    }, 300000);
});
