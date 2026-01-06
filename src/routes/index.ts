import { Router } from 'express';
import {
    zoneController,
    driverController,
    parcelController,
    deliveryController,
} from '../controllers';

const router: Router = Router();

// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'LogistiMa API',
    });
});

// Zone routes
router.get('/zones', (req, res) => zoneController.getAll(req, res));
router.get('/zones/:id', (req, res) => zoneController.getById(req, res));
router.post('/zones', (req, res) => zoneController.create(req, res));
router.put('/zones/:id', (req, res) => zoneController.update(req, res));
router.delete('/zones/:id', (req, res) => zoneController.delete(req, res));

// Driver routes
router.get('/drivers', (req, res) => driverController.getAll(req, res));
router.get('/drivers/:id', (req, res) => driverController.getById(req, res));
router.post('/drivers', (req, res) => driverController.create(req, res));
router.patch('/drivers/:id', (req, res) => driverController.update(req, res));
router.delete('/drivers/:id', (req, res) => driverController.delete(req, res));

// Parcel routes
router.get('/parcels', (req, res) => parcelController.getAll(req, res));
router.get('/parcels/:id', (req, res) => parcelController.getById(req, res));
router.post('/parcels', (req, res) => parcelController.create(req, res));
router.patch('/parcels/:id', (req, res) => parcelController.update(req, res));
// CRITICAL: Dispatch endpoint with concurrency protection
router.post('/parcels/:id/dispatch', (req, res) => parcelController.dispatch(req, res));

// Delivery routes
router.get('/deliveries', (req, res) => deliveryController.getAll(req, res));
router.get('/deliveries/:id', (req, res) => deliveryController.getById(req, res));
router.patch('/deliveries/:id', (req, res) => deliveryController.update(req, res));

export default router;
