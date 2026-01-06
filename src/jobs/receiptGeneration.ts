import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { Delivery, Parcel, Driver } from '../models';

/**
 * Receipt Generation Job Handler
 * 
 * Generates a digital receipt for the delivery and logs it.
 * In a real application, this would:
 * - Generate a PDF receipt
 * - Send an email/SMS notification to the customer
 * - Update tracking systems
 */
export function createReceiptWorker(): Worker {
    const worker = new Worker(
        'receipt',
        async (job: Job<{ deliveryId: string }>) => {
            const { deliveryId } = job.data;

            console.log(`📄 [Receipt] Generating for delivery ${deliveryId}`);

            // Fetch delivery with related data
            const delivery = await Delivery.findByPk(deliveryId, {
                include: [
                    { model: Parcel, as: 'parcel' },
                    { model: Driver, as: 'driver' },
                ],
            });

            if (!delivery) {
                throw new Error(`Delivery ${deliveryId} not found`);
            }

            // Generate receipt content
            const receipt = {
                receiptNumber: `REC-${Date.now().toString(36).toUpperCase()}`,
                deliveryId,
                trackingCode: (delivery as any).parcel?.trackingCode,
                driverName: (delivery as any).driver?.name,
                driverPhone: (delivery as any).driver?.phone,
                pickupAddress: (delivery as any).parcel?.pickupAddress,
                deliveryAddress: (delivery as any).parcel?.deliveryAddress,
                generatedAt: new Date().toISOString(),
            };

            // Log the receipt (simulating notification)
            console.log('═══════════════════════════════════════════════════');
            console.log('📧 RECEIPT NOTIFICATION');
            console.log('═══════════════════════════════════════════════════');
            console.log(`Receipt #: ${receipt.receiptNumber}`);
            console.log(`Tracking: ${receipt.trackingCode}`);
            console.log(`Driver: ${receipt.driverName} (${receipt.driverPhone})`);
            console.log(`From: ${receipt.pickupAddress}`);
            console.log(`To: ${receipt.deliveryAddress}`);
            console.log('═══════════════════════════════════════════════════');

            // Mark receipt as generated
            await Delivery.update(
                { receiptGenerated: true },
                { where: { id: deliveryId } }
            );

            console.log(`✅ [Receipt] Generated for delivery ${deliveryId}`);

            return receipt;
        },
        {
            connection: redis,
            concurrency: 10,
        }
    );

    worker.on('completed', (job) => {
        console.log(`🎉 Receipt job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ Receipt job ${job?.id} failed:`, err);
    });

    return worker;
}
