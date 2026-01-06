import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import { redlock, LOCK_TTL_MS } from '../config/redis';
import { routeQueue, receiptQueue } from '../config/queues';
import { Driver, Parcel, Delivery } from '../models';

export class ConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConflictError';
    }
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}

interface DispatchResult {
    success: boolean;
    deliveryId: string;
    driverId: string;
    message: string;
}

/**
 * Smart Dispatcher Service
 * 
 * Handles the critical business logic of assigning parcels to drivers
 * with concurrency control using:
 * 1. Redis Distributed Lock (Redlock) - prevents race conditions across instances
 * 2. PostgreSQL SERIALIZABLE Transaction - ensures database-level consistency
 */
export class DispatcherService {
    /**
     * Find the nearest available driver with capacity in the same zone
     */
    async findNearestAvailableDriver(
        zoneId: string,
        pickupLat: number,
        pickupLng: number,
        transaction?: Transaction
    ): Promise<Driver | null> {
        const drivers = await Driver.findAll({
            where: {
                zoneId,
                status: 'available',
            },
            transaction,
            lock: transaction ? true : undefined,
        });

        // Filter drivers with capacity and find nearest
        const availableDrivers = drivers.filter((d) => d.capacity > 0);

        if (availableDrivers.length === 0) {
            return null;
        }

        // Calculate distance and sort by proximity
        const driversWithDistance = availableDrivers.map((driver) => ({
            driver,
            distance: this.calculateDistance(
                pickupLat,
                pickupLng,
                Number(driver.latitude),
                Number(driver.longitude)
            ),
        }));

        driversWithDistance.sort((a, b) => a.distance - b.distance);

        return driversWithDistance[0].driver;
    }

    /**
     * Calculate distance between two points using Haversine formula
     */
    private calculateDistance(
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number
    ): number {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Assign a parcel to a driver with full concurrency protection
     * 
     * This is the CRITICAL method that ensures:
     * - Only one parcel can be assigned to a driver with capacity=1 even with 50 concurrent requests
     * - Uses double-locking: Redis (distributed) + PostgreSQL (SERIALIZABLE transaction)
     */
    async assignParcelToDriver(parcelId: string, driverId?: string): Promise<DispatchResult> {
        // First, fetch the parcel to get zone info (outside transaction)
        const parcel = await Parcel.findByPk(parcelId);

        if (!parcel) {
            throw new NotFoundError(`Parcel ${parcelId} not found`);
        }

        if (parcel.status !== 'pending') {
            throw new ConflictError(`Parcel ${parcelId} is not in pending status`);
        }

        // Determine which driver to lock
        let targetDriverId = driverId;

        if (!targetDriverId) {
            // Find the nearest available driver
            const nearestDriver = await this.findNearestAvailableDriver(
                parcel.zoneId,
                Number(parcel.pickupLat),
                Number(parcel.pickupLng)
            );

            if (!nearestDriver) {
                throw new ConflictError('No available drivers in the zone');
            }

            targetDriverId = nearestDriver.id;
        }

        // Acquire distributed lock on the driver
        const lockKey = `lock:driver:${targetDriverId}`;

        let lock;
        try {
            lock = await redlock.acquire([lockKey], LOCK_TTL_MS);
        } catch (error) {
            throw new ConflictError('Could not acquire lock on driver - high contention');
        }

        try {
            // Execute within SERIALIZABLE transaction
            const result = await sequelize.transaction(
                {
                    isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
                },
                async (transaction) => {
                    // Re-fetch driver with lock inside transaction
                    const driver = await Driver.findByPk(targetDriverId, {
                        transaction,
                        lock: true, // SELECT FOR UPDATE
                    });

                    if (!driver) {
                        throw new NotFoundError(`Driver ${targetDriverId} not found`);
                    }

                    // Critical capacity check inside transaction
                    if (driver.capacity <= 0) {
                        throw new ConflictError(`Driver ${targetDriverId} has no capacity`);
                    }

                    if (driver.status !== 'available') {
                        throw new ConflictError(`Driver ${targetDriverId} is not available`);
                    }

                    // Re-fetch parcel inside transaction
                    const parcelInTx = await Parcel.findByPk(parcelId, {
                        transaction,
                        lock: true,
                    });

                    if (!parcelInTx || parcelInTx.status !== 'pending') {
                        throw new ConflictError(`Parcel ${parcelId} is no longer available`);
                    }

                    // Decrement driver capacity and update status
                    driver.capacity -= 1;

                    if (driver.capacity === 0) {
                        driver.status = 'busy';
                    }

                    await driver.save({ transaction });

                    // Assign parcel to driver
                    await parcelInTx.update(
                        {
                            driverId: targetDriverId,
                            status: 'assigned',
                        },
                        { transaction }
                    );

                    // Create delivery record
                    const delivery = await Delivery.create(
                        {
                            parcelId,
                            driverId: targetDriverId!,
                            status: 'pending',
                        },
                        { transaction }
                    );

                    return {
                        deliveryId: delivery.id,
                        driverId: targetDriverId!,
                    };
                }
            );

            // Queue background jobs (outside transaction - fire and forget)
            await this.queueBackgroundJobs(result.deliveryId);

            return {
                success: true,
                deliveryId: result.deliveryId,
                driverId: result.driverId,
                message: 'Parcel successfully assigned to driver',
            };
        } finally {
            // Always release the lock
            await lock.release();
        }
    }

    /**
     * Queue background jobs for route calculation and receipt generation
     */
    private async queueBackgroundJobs(deliveryId: string): Promise<void> {
        try {
            // Job 1: Route calculation (simulated 2 second computation)
            await routeQueue.add(
                'calculate',
                { deliveryId },
                { jobId: `route-${deliveryId}` }
            );

            // Job 2: Receipt generation
            await receiptQueue.add(
                'generate',
                { deliveryId },
                { jobId: `receipt-${deliveryId}` }
            );

            console.log(`📦 Background jobs queued for delivery ${deliveryId}`);
        } catch (error) {
            // Log but don't fail the dispatch - jobs can be retried
            console.error('Failed to queue background jobs:', error);
        }
    }
}

export const dispatcherService = new DispatcherService();
