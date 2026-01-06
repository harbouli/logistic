import { Request, Response } from 'express';
import { Driver } from '../models';
import { DriverWhereOptions } from '../types';

export const driverController = {
    /**
     * GET /api/drivers
     * List all drivers with optional filtering
     */
    async getAll(req: Request, res: Response): Promise<void> {
        try {
            const { status, zoneId } = req.query;

            const where: DriverWhereOptions = {};
            if (status) where.status = status as DriverWhereOptions['status'];
            if (zoneId) where.zoneId = zoneId as string;

            const drivers = await Driver.findAll({ where });

            res.json({
                success: true,
                count: drivers.length,
                data: drivers,
            });
        } catch (error) {
            console.error('Error fetching drivers:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch drivers',
            });
        }
    },

    /**
     * GET /api/drivers/:id
     * Get a single driver
     */
    async getById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const driver = await Driver.findByPk(id);

            if (!driver) {
                res.status(404).json({
                    success: false,
                    error: 'Driver not found',
                });
                return;
            }

            res.json({
                success: true,
                data: driver,
            });
        } catch (error) {
            console.error('Error fetching driver:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch driver',
            });
        }
    },

    /**
     * POST /api/drivers
     * Create a new driver
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name, phone, latitude, longitude, capacity, zoneId } = req.body;

            if (!name || !phone || latitude === undefined || longitude === undefined || !zoneId) {
                res.status(400).json({
                    success: false,
                    error: 'Name, phone, latitude, longitude, and zoneId are required',
                });
                return;
            }

            const driver = await Driver.create({
                name,
                phone,
                latitude,
                longitude,
                capacity: capacity || 5,
                zoneId,
            });

            res.status(201).json({
                success: true,
                data: driver,
            });
        } catch (error) {
            console.error('Error creating driver:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create driver',
            });
        }
    },

    /**
     * PATCH /api/drivers/:id
     * Update a driver (status, capacity, location)
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { name, phone, latitude, longitude, capacity, status, zoneId } = req.body;

            const driver = await Driver.findByPk(id);

            if (!driver) {
                res.status(404).json({
                    success: false,
                    error: 'Driver not found',
                });
                return;
            }

            await driver.update({
                name: name ?? driver.name,
                phone: phone ?? driver.phone,
                latitude: latitude ?? driver.latitude,
                longitude: longitude ?? driver.longitude,
                capacity: capacity ?? driver.capacity,
                status: status ?? driver.status,
                zoneId: zoneId ?? driver.zoneId,
            });

            res.json({
                success: true,
                data: driver,
            });
        } catch (error) {
            console.error('Error updating driver:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update driver',
            });
        }
    },

    /**
     * DELETE /api/drivers/:id
     * Delete a driver
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const driver = await Driver.findByPk(id);

            if (!driver) {
                res.status(404).json({
                    success: false,
                    error: 'Driver not found',
                });
                return;
            }

            await driver.destroy();

            res.json({
                success: true,
                message: 'Driver deleted successfully',
            });
        } catch (error) {
            console.error('Error deleting driver:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete driver',
            });
        }
    },
};
