import { Request, Response } from 'express';
import { Zone } from '../models';
import { zoneCacheService } from '../services';
import { isSequelizeError } from '../types';

export const zoneController = {
    /**
     * GET /api/zones
     * List all zones (from cache)
     */
    async getAll(_req: Request, res: Response): Promise<void> {
        try {
            const zones = await zoneCacheService.getZones();
            res.json({
                success: true,
                count: zones.length,
                data: zones,
            });
        } catch (error) {
            console.error('Error fetching zones:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch zones',
            });
        }
    },

    /**
     * GET /api/zones/:id
     * Get a single zone by ID
     */
    async getById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const zone = await zoneCacheService.getZoneById(id);

            if (!zone) {
                res.status(404).json({
                    success: false,
                    error: 'Zone not found',
                });
                return;
            }

            res.json({
                success: true,
                data: zone,
            });
        } catch (error) {
            console.error('Error fetching zone:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch zone',
            });
        }
    },

    /**
     * POST /api/zones
     * Create a new zone
     */
    async create(req: Request, res: Response): Promise<void> {
        try {
            const { name, centerLat, centerLng, radius } = req.body;

            if (!name || centerLat === undefined || centerLng === undefined) {
                res.status(400).json({
                    success: false,
                    error: 'Name, centerLat, and centerLng are required',
                });
                return;
            }

            const zone = await Zone.create({
                name,
                centerLat,
                centerLng,
                radius: radius || 5.0,
            });

            res.status(201).json({
                success: true,
                data: zone,
            });
        } catch (error) {
            console.error('Error creating zone:', error);

            if (isSequelizeError(error) && error.name === 'SequelizeUniqueConstraintError') {
                res.status(409).json({
                    success: false,
                    error: 'Zone with this name already exists',
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Failed to create zone',
            });
        }
    },

    /**
     * PUT /api/zones/:id
     * Update a zone
     */
    async update(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { name, centerLat, centerLng, radius } = req.body;

            const zone = await Zone.findByPk(id);

            if (!zone) {
                res.status(404).json({
                    success: false,
                    error: 'Zone not found',
                });
                return;
            }

            await zone.update({
                name: name ?? zone.name,
                centerLat: centerLat ?? zone.centerLat,
                centerLng: centerLng ?? zone.centerLng,
                radius: radius ?? zone.radius,
            });

            res.json({
                success: true,
                data: zone,
            });
        } catch (error) {
            console.error('Error updating zone:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update zone',
            });
        }
    },

    /**
     * DELETE /api/zones/:id
     * Delete a zone
     */
    async delete(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const zone = await Zone.findByPk(id);

            if (!zone) {
                res.status(404).json({
                    success: false,
                    error: 'Zone not found',
                });
                return;
            }

            await zone.destroy();

            res.json({
                success: true,
                message: 'Zone deleted successfully',
            });
        } catch (error) {
            console.error('Error deleting zone:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete zone',
            });
        }
    },
};
