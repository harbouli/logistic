import { Request, Response } from 'express';
import { Parcel } from '../models';
import { dispatcherService, ConflictError, NotFoundError } from '../services';
import { ParcelWhereOptions } from '../types';

export const parcelController = {
    /**
     * GET /api/parcels
     * List all parcels with optional filtering
     */
    async getAll(req: Request, res: Response): Promise<void> {
        try {
            const { status, zoneId, driverId } = req.query;

            const where: ParcelWhereOptions = {};
            if (status) where.status = status as ParcelWhereOptions['status'];
            if (zoneId) where.zoneId = zoneId as string;
            if (driverId) where.driverId = driverId as string;

            const parcels = await Parcel.findAll({ where });

            res.json({
                success: true,
                count: parcels.length,
                data: parcels,
            });
        } catch (error) {
            console.error('Error fetching parcels:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch parcels',
            });
        }
    },

    /**
     * GET /api/parcels/:id
     * Get a single parcel
     */
    async getById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const parcel = await Parcel.findByPk(id);

            if (!parcel) {
                res.status(404).json({
                    success: false,
                    error: 'Parcel not found',
                });
                return;
            }

            res.json({
                success: true,
                data: parcel,
            });
        } catch (error) {
            console.error('Error fetching parcel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch parcel',
            });
        }
    },

    /**
     * POST /api/parcels
     * Create a new parcel
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const {
                pickupAddress,
                pickupLat,
                pickupLng,
                deliveryAddress,
                deliveryLat,
                deliveryLng,
                weight,
                zoneId,
            } = req.body;

            if (!pickupAddress || pickupLat === undefined || pickupLng === undefined ||
                !deliveryAddress || deliveryLat === undefined || deliveryLng === undefined ||
                !zoneId) {
                res.status(400).json({
                    success: false,
                    error: 'Pickup/delivery addresses, coordinates, and zoneId are required',
                });
                return;
            }

            const parcel = await Parcel.create({
                pickupAddress,
                pickupLat,
                pickupLng,
                deliveryAddress,
                deliveryLat,
                deliveryLng,
                weight: weight || 1.0,
                zoneId,
            });

            res.status(201).json({
                success: true,
                data: parcel,
            });
        } catch (error) {
            console.error('Error creating parcel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create parcel',
            });
        }
    },

    /**
     * POST /api/parcels/:id/dispatch
     * CRITICAL ENDPOINT: Dispatch a parcel to an available driver
     * 
     * This endpoint uses distributed locking to prevent race conditions.
     * Only one request can assign a parcel to a driver with capacity=1.
     */
    async dispatch(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { driverId } = req.body; // Optional - if not provided, finds nearest

            const result = await dispatcherService.assignParcelToDriver(id, driverId);

            res.status(201).json({
                success: true,
                data: result,
            });
        } catch (error) {
            console.error('Error dispatching parcel:', error);

            if (error instanceof NotFoundError) {
                res.status(404).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            if (error instanceof ConflictError) {
                res.status(409).json({
                    success: false,
                    error: error.message,
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Failed to dispatch parcel',
            });
        }
    },

    /**
     * PATCH /api/parcels/:id
     * Update parcel status
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const parcel = await Parcel.findByPk(id);

            if (!parcel) {
                res.status(404).json({
                    success: false,
                    error: 'Parcel not found',
                });
                return;
            }

            await parcel.update({ status });

            res.json({
                success: true,
                data: parcel,
            });
        } catch (error) {
            console.error('Error updating parcel:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update parcel',
            });
        }
    },
};
