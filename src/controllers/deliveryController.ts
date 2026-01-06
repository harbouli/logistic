import { Request, Response } from 'express';
import { Delivery, Parcel, Driver } from '../models';
import { DeliveryWhereOptions, DeliveryUpdatePayload } from '../types';

export const deliveryController = {
    /**
     * GET /api/deliveries
     * List all deliveries with optional filtering
     */
    async getAll(req: Request, res: Response): Promise<void> {
        try {
            const { status, driverId } = req.query;

            const where: DeliveryWhereOptions = {};
            if (status) where.status = status as DeliveryWhereOptions['status'];
            if (driverId) where.driverId = driverId as string;

            const deliveries = await Delivery.findAll({
                where,
                include: [
                    { model: Parcel, as: 'parcel' },
                    { model: Driver, as: 'driver' },
                ],
            });

            res.json({
                success: true,
                count: deliveries.length,
                data: deliveries,
            });
        } catch (error) {
            console.error('Error fetching deliveries:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch deliveries',
            });
        }
    },

    /**
     * GET /api/deliveries/:id
     * Get a single delivery with full details
     */
    async getById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const delivery = await Delivery.findByPk(id, {
                include: [
                    { model: Parcel, as: 'parcel' },
                    { model: Driver, as: 'driver' },
                ],
            });

            if (!delivery) {
                res.status(404).json({
                    success: false,
                    error: 'Delivery not found',
                });
                return;
            }

            res.json({
                success: true,
                data: delivery,
            });
        } catch (error) {
            console.error('Error fetching delivery:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch delivery',
            });
        }
    },

    /**
     * PATCH /api/deliveries/:id
     * Update delivery status
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const delivery = await Delivery.findByPk(id);

            if (!delivery) {
                res.status(404).json({
                    success: false,
                    error: 'Delivery not found',
                });
                return;
            }

            const updates: DeliveryUpdatePayload = { status };

            // Set timestamps based on status
            if (status === 'in_progress' && !delivery.startedAt) {
                updates.startedAt = new Date();
            }
            if (status === 'completed' && !delivery.completedAt) {
                updates.completedAt = new Date();

                // Restore driver capacity
                const driver = await Driver.findByPk(delivery.driverId);
                if (driver) {
                    await driver.increment('capacity');
                    if (driver.status === 'busy') {
                        await driver.update({ status: 'available' });
                    }
                }
            }

            await delivery.update(updates);

            res.json({
                success: true,
                data: delivery,
            });
        } catch (error) {
            console.error('Error updating delivery:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update delivery',
            });
        }
    },
};
