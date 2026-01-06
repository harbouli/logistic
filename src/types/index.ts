import { ParcelStatus } from '../models/Parcel';
import { DriverStatus } from '../models/Driver';
import { DeliveryStatus } from '../models/Delivery';

/**
 * Filter options for Parcel queries - uses Record to be compatible with Sequelize WhereOptions
 */
export type ParcelWhereOptions = Partial<{
    status: ParcelStatus;
    zoneId: string;
    driverId: string;
}>;

/**
 * Filter options for Driver queries
 */
export type DriverWhereOptions = Partial<{
    status: DriverStatus;
    zoneId: string;
}>;

/**
 * Filter options for Delivery queries
 */
export type DeliveryWhereOptions = Partial<{
    status: DeliveryStatus;
    driverId: string;
}>;

/**
 * Delivery update payload
 */
export interface DeliveryUpdatePayload {
    status: DeliveryStatus;
    startedAt?: Date;
    completedAt?: Date;
}

/**
 * Sequelize error with name property for constraint handling
 */
export interface SequelizeError extends Error {
    name: string;
}

/**
 * Type guard to check if an error is a Sequelize error
 */
export function isSequelizeError(error: unknown): error is SequelizeError {
    return error instanceof Error && 'name' in error;
}
