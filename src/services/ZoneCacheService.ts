import { redis } from '../config/redis';
import { Zone } from '../models';

const CACHE_KEY = 'zones:all';
const CACHE_TTL = 3600; // 1 hour

interface ZoneData {
    id: string;
    name: string;
    centerLat: number;
    centerLng: number;
    radius: number;
}

/**
 * Zone Cache Service
 * 
 * Caches the Casablanca delivery zones in Redis to avoid
 * hitting PostgreSQL on every request.
 * 
 * Zones are invalidated when:
 * - A zone is created
 * - A zone is updated
 * - A zone is deleted
 */
export class ZoneCacheService {
    /**
     * Get all zones from cache or database
     */
    async getZones(): Promise<ZoneData[]> {
        try {
            // Try cache first
            const cached = await redis.get(CACHE_KEY);

            if (cached) {
                console.log('📍 Zones loaded from Redis cache');
                return JSON.parse(cached);
            }
        } catch (error) {
            console.error('Redis cache read error:', error);
            // Continue to database fallback
        }

        // Cache miss - load from database
        const zones = await Zone.findAll({
            attributes: ['id', 'name', 'centerLat', 'centerLng', 'radius'],
            order: [['name', 'ASC']],
        });

        const zoneData = zones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            centerLat: Number(zone.centerLat),
            centerLng: Number(zone.centerLng),
            radius: Number(zone.radius),
        }));

        // Store in cache
        try {
            await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(zoneData));
            console.log('📍 Zones cached in Redis');
        } catch (error) {
            console.error('Redis cache write error:', error);
        }

        return zoneData;
    }

    /**
     * Get a single zone by ID
     */
    async getZoneById(zoneId: string): Promise<ZoneData | null> {
        const zones = await this.getZones();
        return zones.find((z) => z.id === zoneId) || null;
    }

    /**
     * Get a zone by name
     */
    async getZoneByName(name: string): Promise<ZoneData | null> {
        const zones = await this.getZones();
        return zones.find((z) => z.name.toLowerCase() === name.toLowerCase()) || null;
    }

    /**
     * Invalidate the cache (called after zone CRUD operations)
     */
    async invalidateCache(): Promise<void> {
        try {
            await redis.del(CACHE_KEY);
            console.log('📍 Zone cache invalidated');
        } catch (error) {
            console.error('Redis cache invalidation error:', error);
        }
    }

    /**
     * Force refresh the cache
     */
    async refreshCache(): Promise<ZoneData[]> {
        await this.invalidateCache();
        return this.getZones();
    }
}

export const zoneCacheService = new ZoneCacheService();

/**
 * Setup Sequelize hooks for automatic cache invalidation
 */
export function setupZoneCacheHooks(): void {
    Zone.afterCreate(async () => {
        await zoneCacheService.invalidateCache();
    });

    Zone.afterUpdate(async () => {
        await zoneCacheService.invalidateCache();
    });

    Zone.afterDestroy(async () => {
        await zoneCacheService.invalidateCache();
    });

    Zone.afterBulkCreate(async () => {
        await zoneCacheService.invalidateCache();
    });

    Zone.afterBulkUpdate(async () => {
        await zoneCacheService.invalidateCache();
    });

    Zone.afterBulkDestroy(async () => {
        await zoneCacheService.invalidateCache();
    });

    console.log('✅ Zone cache hooks registered');
}
