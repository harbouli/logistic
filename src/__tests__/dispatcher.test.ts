import request from 'supertest';
import { app } from '../app';
import sequelize from '../config/database';
import { redis } from '../config/redis';
import { Zone, Driver, Parcel, Delivery } from '../models';

describe('Smart Dispatcher', () => {
    let zone: Zone;
    let driver: Driver;

    beforeAll(async () => {
        // Initialize database
        await sequelize.sync({ force: true });

        // Create test zone (Casablanca - Anfa)
        zone = await Zone.create({
            name: 'Anfa',
            centerLat: 33.5731,
            centerLng: -7.5898,
            radius: 5.0,
        });

        console.log('Test zone created:', zone.id);
    });

    beforeEach(async () => {
        // Clean up deliveries, parcels, and reset drivers
        await Delivery.destroy({ where: {} });
        await Parcel.destroy({ where: {} });
        await Driver.destroy({ where: {} });

        // Flush Redis locks
        const keys = await redis.keys('lock:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    });

    afterAll(async () => {
        await sequelize.close();
        await redis.quit();
    });

    describe('POST /api/parcels/:id/dispatch', () => {
        it('should successfully dispatch a parcel to an available driver', async () => {
            // Create driver with capacity
            driver = await Driver.create({
                name: 'Mohamed',
                phone: '+212600000001',
                latitude: 33.5731,
                longitude: -7.5898,
                capacity: 5,
                zoneId: zone.id,
            });

            // Create parcel
            const parcel = await Parcel.create({
                pickupAddress: '123 Anfa Street',
                pickupLat: 33.5730,
                pickupLng: -7.5897,
                deliveryAddress: '456 Gauthier Ave',
                deliveryLat: 33.5900,
                deliveryLng: -7.6000,
                weight: 1.0,
                zoneId: zone.id,
            });

            // Dispatch
            const response = await request(app)
                .post(`/api/parcels/${parcel.id}/dispatch`)
                .send({});

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.driverId).toBe(driver.id);

            // Verify driver capacity decreased
            await driver.reload();
            expect(driver.capacity).toBe(4);
        });

        it('should return 404 for non-existent parcel', async () => {
            const response = await request(app)
                .post('/api/parcels/00000000-0000-0000-0000-000000000000/dispatch')
                .send({});

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });

        it('should return 409 when driver has no capacity', async () => {
            // Create driver with NO capacity
            driver = await Driver.create({
                name: 'Ahmed',
                phone: '+212600000002',
                latitude: 33.5731,
                longitude: -7.5898,
                capacity: 0,
                status: 'busy',
                zoneId: zone.id,
            });

            // Create parcel
            const parcel = await Parcel.create({
                pickupAddress: '123 Test Street',
                pickupLat: 33.5730,
                pickupLng: -7.5897,
                deliveryAddress: '456 Test Ave',
                deliveryLat: 33.5900,
                deliveryLng: -7.6000,
                weight: 1.0,
                zoneId: zone.id,
            });

            const response = await request(app)
                .post(`/api/parcels/${parcel.id}/dispatch`)
                .send({});

            expect(response.status).toBe(409);
            expect(response.body.success).toBe(false);
        });

        it('should return 409 for already assigned parcel', async () => {
            driver = await Driver.create({
                name: 'Youssef',
                phone: '+212600000003',
                latitude: 33.5731,
                longitude: -7.5898,
                capacity: 5,
                zoneId: zone.id,
            });

            // Create an already assigned parcel
            const parcel = await Parcel.create({
                pickupAddress: '123 Test Street',
                pickupLat: 33.5730,
                pickupLng: -7.5897,
                deliveryAddress: '456 Test Ave',
                deliveryLat: 33.5900,
                deliveryLng: -7.6000,
                status: 'assigned',
                driverId: driver.id,
                weight: 1.0,
                zoneId: zone.id,
            });

            const response = await request(app)
                .post(`/api/parcels/${parcel.id}/dispatch`)
                .send({});

            expect(response.status).toBe(409);
            expect(response.body.success).toBe(false);
        });
    });
});
