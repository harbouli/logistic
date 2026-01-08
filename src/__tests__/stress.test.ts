import request from 'supertest';
import { app } from '../app';
import sequelize from '../config/database';
import { redis } from '../config/redis';
import { Zone, Driver, Parcel, Delivery } from '../models';

/**
 * STRESS TEST: 50 Concurrent Requests
 * 
 * This test validates the concurrency control mechanism:
 * - Creates a driver with capacity = 1
 * - Sends 50 simultaneous dispatch requests
 * - Expects exactly 1 success (201) and 49 conflicts (409)
 */
describe('Stress Test - 50 Concurrent Requests', () => {
    let zone: Zone;
    let driver: Driver;
    let parcels: Parcel[];

    // Run once before all tests in this suite
    beforeAll(async () => {
        // Initialize database with force:true to recreate tables
        await sequelize.sync({ force: true });

        // Create test zone (Sidi Maarif) for the stress test
        zone = await Zone.create({
            name: 'Sidi Maarif',
            centerLat: 33.5600,
            centerLng: -7.6200,
            radius: 5.0,
        });

        console.log('Stress test zone created:', zone.id);
    });

    // Run before each test case to reset the environment
    beforeEach(async () => {
        // Clean up all related tables to start fresh
        await Delivery.destroy({ where: {} });
        await Parcel.destroy({ where: {} });
        await Driver.destroy({ where: {} });

        // Flush Redis locks to prevent interference from previous runs
        const keys = await redis.keys('lock:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }

        // Create driver with capacity = 1 (CRITICAL for this test)
        driver = await Driver.create({
            name: 'Stress Test Driver',
            phone: '+212600000099',
            latitude: 33.5600,
            longitude: -7.6200,
            capacity: 1,
            zoneId: zone.id,
        });

        // Create 50 unique parcels to be used in the concurrent requests
        parcels = await Promise.all(
            Array(50)
                .fill(null)
                .map((_, i) =>
                    Parcel.create({
                        pickupAddress: `Pickup Address ${i + 1}`,
                        pickupLat: 33.5600 + Math.random() * 0.01,
                        pickupLng: -7.6200 + Math.random() * 0.01,
                        deliveryAddress: `Delivery Address ${i + 1}`,
                        deliveryLat: 33.5700 + Math.random() * 0.01,
                        deliveryLng: -7.6100 + Math.random() * 0.01,
                        weight: 1.0,
                        zoneId: zone.id,
                    })
                )
        );

        console.log(`Created ${parcels.length} parcels for stress test`);
    });

    afterAll(async () => {
        await sequelize.close();
        await redis.quit();
    });

    it('should allow only ONE dispatch when driver has capacity=1 (50 concurrent requests)', async () => {
        console.log('\n🔥 STRESS TEST: Sending 50 concurrent dispatch requests...\n');

        // Send 50 concurrent dispatch requests for the created parcels
        // We catch errors individually to ensure Promise.all doesn't fail on the first error
        const results = await Promise.all(
            parcels.map((parcel) =>
                request(app)
                    .post(`/api/parcels/${parcel.id}/dispatch`)
                    .send({ driverId: driver.id })
                    .catch((err) => ({
                        status: 500,
                        body: { error: err.message },
                    }))
            )
        );

        // Count results
        const successes = results.filter((r) => r.status === 201);
        const conflicts = results.filter((r) => r.status === 409);
        const notFound = results.filter((r) => r.status === 404);
        const errors = results.filter((r) => r.status === 500);

        console.log('\n📊 STRESS TEST RESULTS:');
        console.log(`   ✅ Successes (201): ${successes.length}`);
        console.log(`   ⚠️  Conflicts (409): ${conflicts.length}`);
        console.log(`   ❓ Not Found (404): ${notFound.length}`);
        console.log(`   ❌ Errors (500): ${errors.length}`);

        // CRITICAL ASSERTIONS
        expect(successes.length).toBe(1);
        expect(conflicts.length).toBe(49);
        expect(errors.length).toBe(0);

        // Verify driver capacity is now 0
        await driver.reload();
        expect(driver.capacity).toBe(0);
        expect(driver.status).toBe('busy');

        // Verify only one delivery was created
        const deliveryCount = await Delivery.count();
        expect(deliveryCount).toBe(1);

        console.log('\n✅ STRESS TEST PASSED: Only 1 parcel was dispatched!\n');
    }, 60000); // 60 second timeout for stress test
});
