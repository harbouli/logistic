import { redis } from '../config/redis';
import { zoneCacheService } from '../services';
import sequelize from '../config/database';
import { Zone } from '../models';

// Test suite for the Zone Cache Service
// Verifies caching behavior for zone data to reduce database load
describe('Zone Cache Service', () => {
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    // Reset cache and database state before each test
    beforeEach(async () => {
        // Clear global zone cache
        await redis.del('zones:all');
        // Remove all zones from DB
        await Zone.destroy({ where: {} });
    });

    afterAll(async () => {
        await sequelize.close();
        await redis.quit();
    });

    describe('getZones', () => {
        // Test case: Verifies that data is fetched from DB when cache is empty and then cached
        it('should fetch zones from database on cache miss', async () => {
            // Setup: Create zones in the database
            await Zone.create({
                name: 'Anfa',
                centerLat: 33.5731,
                centerLng: -7.5898,
                radius: 5.0,
            });

            await Zone.create({
                name: 'Gauthier',
                centerLat: 33.5900,
                centerLng: -7.6000,
                radius: 4.0,
            });

            // Fetch zones (should hit database)
            const zones = await zoneCacheService.getZones();

            expect(zones).toHaveLength(2);
            expect(zones.map((z) => z.name).sort()).toEqual(['Anfa', 'Gauthier']);

            // Verify cache was populated
            const cached = await redis.get('zones:all');
            expect(cached).not.toBeNull();
            expect(JSON.parse(cached!)).toHaveLength(2);
        });

        // Test case: Verifies that data is fetched from Redis cache when available, bypassing DB
        it('should return zones fromcache on subsequent calls', async () => {
            // Setup: Manually seed the cache with mock data
            const mockZones = [
                { id: 'test-1', name: 'Cached Zone', centerLat: 33.5, centerLng: -7.5, radius: 3 },
            ];
            await redis.setex('zones:all', 3600, JSON.stringify(mockZones));

            // Fetch zones (should hit cache, not database)
            const zones = await zoneCacheService.getZones();

            expect(zones).toHaveLength(1);
            expect(zones[0].name).toBe('Cached Zone');
        });
    });

    describe('invalidateCache', () => {
        it('should clear the cache', async () => {
            // Pre-populate cache
            await redis.setex('zones:all', 3600, JSON.stringify([{ name: 'Test' }]));

            // Invalidate
            await zoneCacheService.invalidateCache();

            // Verify cache is empty
            const cached = await redis.get('zones:all');
            expect(cached).toBeNull();
        });
    });

    describe('getZoneById', () => {
        it('should return a specific zone by ID', async () => {
            const zone = await Zone.create({
                name: 'Maarif',
                centerLat: 33.5800,
                centerLng: -7.6100,
                radius: 4.5,
            });

            const found = await zoneCacheService.getZoneById(zone.id);

            expect(found).not.toBeNull();
            expect(found!.name).toBe('Maarif');
        });

        it('should return null for non-existent zone', async () => {
            const found = await zoneCacheService.getZoneById('non-existent-id');
            expect(found).toBeNull();
        });
    });
});
