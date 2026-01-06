import { redis } from '../config/redis';
import { zoneCacheService } from '../services';
import sequelize from '../config/database';
import { Zone } from '../models';

describe('Zone Cache Service', () => {
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        // Clear cache and zones
        await redis.del('zones:all');
        await Zone.destroy({ where: {} });
    });

    afterAll(async () => {
        await sequelize.close();
        await redis.quit();
    });

    describe('getZones', () => {
        it('should fetch zones from database on cache miss', async () => {
            // Create zones
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

        it('should return zones from cache on subsequent calls', async () => {
            // Pre-populate cache
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
