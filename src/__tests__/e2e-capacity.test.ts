import request from 'supertest';
import { app } from '../app';
import sequelize from '../config/database';
import { redis } from '../config/redis';
import { routeQueue, receiptQueue } from '../config/queues';
import { Zone, Driver, Parcel, Delivery } from '../models';
import { createRouteWorker } from '../jobs/routeCalculation';
import { createReceiptWorker } from '../jobs/receiptGeneration';
import { Worker } from 'bullmq';

/**
 * E2E CAPACITY TEST: Fewer Drivers Than Parcels
 * 
 * Tests the scenario where demand (parcels) exceeds supply (driver capacity).
 * - Creates 10 drivers with capacity=1 each (total capacity: 10)
 * - Creates 50 parcels
 * - Dispatches all 50 parcels
 * - Expects exactly 10 successful dispatches and 40 conflicts
 */
describe('E2E Capacity Test - Fewer Drivers Than Parcels', () => {
    let zone: Zone;
    let routeWorker: Worker;
    let receiptWorker: Worker;

    beforeAll(async () => {
        // Initialize database
        await sequelize.sync({ force: true });

        // Create test zone
        zone = await Zone.create({
            name: 'Capacity Test Zone',
            centerLat: 33.5600,
            centerLng: -7.6200,
            radius: 10.0,
        });

        // Start workers for processing jobs
        routeWorker = createRouteWorker();
        receiptWorker = createReceiptWorker();

        console.log('✅ Capacity Test setup complete');
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

        // Obliterate the queues to start fresh
        await routeQueue.obliterate({ force: true });
        await receiptQueue.obliterate({ force: true });
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
        timeoutMs: number = 60000
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

    it('should handle 50 parcels with only 10 drivers (capacity constraint)', async () => {
        console.log('\n🔥 CAPACITY TEST: 50 parcels but only 10 drivers (capacity=1 each)...\n');

        // Create only 10 drivers with capacity=1
        const drivers = await Promise.all(
            Array(10)
                .fill(null)
                .map((_, i) =>
                    Driver.create({
                        name: `Limited Driver ${i + 1}`,
                        phone: `+21261111${String(i).padStart(4, '0')}`,
                        latitude: 33.5600 + (Math.random() - 0.5) * 0.02,
                        longitude: -7.6200 + (Math.random() - 0.5) * 0.02,
                        capacity: 1,
                        zoneId: zone.id,
                    })
                )
        );

        // Create 50 parcels
        const parcels = await Promise.all(
            Array(50)
                .fill(null)
                .map((_, i) =>
                    Parcel.create({
                        pickupAddress: `Pickup ${i + 1}`,
                        pickupLat: 33.5600 + Math.random() * 0.01,
                        pickupLng: -7.6200 + Math.random() * 0.01,
                        deliveryAddress: `Delivery ${i + 1}`,
                        deliveryLat: 33.5700 + Math.random() * 0.01,
                        deliveryLng: -7.6100 + Math.random() * 0.01,
                        weight: 1.0,
                        zoneId: zone.id,
                    })
                )
        );

        console.log(`📦 Created ${drivers.length} drivers and ${parcels.length} parcels\n`);

        const dispatchStartTime = Date.now();
        let successCount = 0;
        let conflictCount = 0;

        // Dispatch all 50 parcels (without specifying driver - let system find nearest)
        for (const parcel of parcels) {
            const result = await request(app)
                .post(`/api/parcels/${parcel.id}/dispatch`)
                .send({}); // No driverId - system finds available driver

            if (result.status === 201) successCount++;
            else if (result.status === 409) conflictCount++;
        }

        const dispatchDuration = Date.now() - dispatchStartTime;

        console.log('📊 CAPACITY TEST RESULTS:');
        console.log(`   ✅ Successful Dispatches: ${successCount}`);
        console.log(`   ⚠️  Conflicts (no capacity): ${conflictCount}`);
        console.log(`   ⏱️  Duration: ${dispatchDuration}ms`);

        // Exactly 10 parcels should be dispatched (10 drivers × 1 capacity)
        expect(successCount).toBe(10);
        // Remaining 40 should fail with conflict (no available drivers)
        expect(conflictCount).toBe(40);

        // Wait for route jobs to complete
        console.log('\n⏳ Waiting for 10 route jobs to complete...');
        const routeResults = await waitForQueueCompletion(routeQueue, 10);

        console.log(`📊 ROUTE JOBS: ${routeResults.completed} completed, ${routeResults.failed} failed`);
        expect(routeResults.completed).toBe(10);

        // Verify deliveries
        const deliveryCount = await Delivery.count();
        expect(deliveryCount).toBe(10);

        // Verify all drivers are now busy
        const busyDrivers = await Driver.count({ where: { status: 'busy' } });
        expect(busyDrivers).toBe(10);

        // Verify 40 parcels are still pending
        const pendingParcels = await Parcel.count({ where: { status: 'pending' } });
        expect(pendingParcels).toBe(40);

        console.log('\n' + '='.repeat(50));
        console.log('✅ CAPACITY TEST PASSED!');
        console.log(`   📦 Parcels Requested: 50`);
        console.log(`   👨‍✈️ Drivers Available: 10`);
        console.log(`   ✅ Dispatched: ${successCount}`);
        console.log(`   ⏳ Pending (no capacity): ${pendingParcels}`);
        console.log('='.repeat(50) + '\n');
    }, 120000);

    it('should correctly dispatch when drivers have varying capacities', async () => {
        console.log('\n🔥 MIXED CAPACITY TEST: Drivers with different capacities...\n');

        // Create drivers with varying capacities (total capacity: 15)
        const driverConfigs = [
            { capacity: 5 }, // Driver 1 can take 5 parcels
            { capacity: 3 }, // Driver 2 can take 3 parcels
            { capacity: 3 }, // Driver 3 can take 3 parcels
            { capacity: 2 }, // Driver 4 can take 2 parcels
            { capacity: 2 }, // Driver 5 can take 2 parcels
        ];

        const drivers = await Promise.all(
            driverConfigs.map((config, i) =>
                Driver.create({
                    name: `Mixed Driver ${i + 1}`,
                    phone: `+21262222${String(i).padStart(4, '0')}`,
                    latitude: 33.5600 + (Math.random() - 0.5) * 0.02,
                    longitude: -7.6200 + (Math.random() - 0.5) * 0.02,
                    capacity: config.capacity,
                    zoneId: zone.id,
                })
            )
        );

        const totalCapacity = driverConfigs.reduce((sum, d) => sum + d.capacity, 0);
        console.log(`👨‍✈️ Created ${drivers.length} drivers with total capacity: ${totalCapacity}\n`);

        // Create 25 parcels (more than total capacity of 15)
        const parcels = await Promise.all(
            Array(25)
                .fill(null)
                .map((_, i) =>
                    Parcel.create({
                        pickupAddress: `Mixed Pickup ${i + 1}`,
                        pickupLat: 33.5600 + Math.random() * 0.01,
                        pickupLng: -7.6200 + Math.random() * 0.01,
                        deliveryAddress: `Mixed Delivery ${i + 1}`,
                        deliveryLat: 33.5700 + Math.random() * 0.01,
                        deliveryLng: -7.6100 + Math.random() * 0.01,
                        weight: 1.0,
                        zoneId: zone.id,
                    })
                )
        );

        console.log(`📦 Created ${parcels.length} parcels\n`);

        let successCount = 0;
        let conflictCount = 0;

        // Dispatch all 25 parcels
        for (const parcel of parcels) {
            const result = await request(app)
                .post(`/api/parcels/${parcel.id}/dispatch`)
                .send({});

            if (result.status === 201) successCount++;
            else if (result.status === 409) conflictCount++;
        }

        console.log('📊 MIXED CAPACITY RESULTS:');
        console.log(`   ✅ Successful Dispatches: ${successCount}`);
        console.log(`   ⚠️  Conflicts (no capacity): ${conflictCount}`);

        // Should dispatch exactly 15 (total capacity)
        expect(successCount).toBe(totalCapacity);
        expect(conflictCount).toBe(25 - totalCapacity);

        // Wait for route jobs
        const routeResults = await waitForQueueCompletion(routeQueue, totalCapacity);
        expect(routeResults.completed).toBe(totalCapacity);

        // Verify all drivers now have 0 capacity
        const zeroCapacityDrivers = await Driver.count({ where: { capacity: 0 } });
        expect(zeroCapacityDrivers).toBe(drivers.length);

        console.log('\n' + '='.repeat(50));
        console.log('✅ MIXED CAPACITY TEST PASSED!');
        console.log(`   📦 Parcels: 25`);
        console.log(`   👨‍✈️ Total Capacity: ${totalCapacity}`);
        console.log(`   ✅ Dispatched: ${successCount}`);
        console.log(`   ⏳ Pending: ${conflictCount}`);
        console.log('='.repeat(50) + '\n');
    }, 120000);
});
