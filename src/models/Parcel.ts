import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Zone from './Zone';
import Driver from './Driver';

export type ParcelStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

interface ParcelAttributes {
    id: string;
    trackingCode: string;
    status: ParcelStatus;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    deliveryAddress: string;
    deliveryLat: number;
    deliveryLng: number;
    weight: number;
    zoneId: string;
    driverId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ParcelCreationAttributes extends Optional<ParcelAttributes, 'id' | 'trackingCode' | 'status' | 'driverId'> { }

class Parcel extends Model<ParcelAttributes, ParcelCreationAttributes> implements ParcelAttributes {
    declare id: string;
    declare trackingCode: string;
    declare status: ParcelStatus;
    declare pickupAddress: string;
    declare pickupLat: number;
    declare pickupLng: number;
    declare deliveryAddress: string;
    declare deliveryLat: number;
    declare deliveryLng: number;
    declare weight: number;
    declare zoneId: string;
    declare driverId: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

// Generate tracking code
function generateTrackingCode(): string {
    const prefix = 'LMA';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

Parcel.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        trackingCode: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            defaultValue: generateTrackingCode,
        },
        status: {
            type: DataTypes.ENUM('pending', 'assigned', 'in_transit', 'delivered', 'cancelled'),
            allowNull: false,
            defaultValue: 'pending',
        },
        pickupAddress: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        pickupLat: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false,
        },
        pickupLng: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false,
        },
        deliveryAddress: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        deliveryLat: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false,
        },
        deliveryLng: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false,
        },
        weight: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 1.0,
        },
        zoneId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'zones',
                key: 'id',
            },
        },
        driverId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'drivers',
                key: 'id',
            },
        },
    },
    {
        sequelize,
        tableName: 'parcels',
        timestamps: true,
        indexes: [
            {
                fields: ['status'],
            },
            {
                fields: ['trackingCode'],
                unique: true,
            },
            {
                fields: ['zoneId'],
            },
            {
                fields: ['driverId'],
            },
        ],
    }
);

// Associations
Parcel.belongsTo(Zone, { foreignKey: 'zoneId', as: 'zone' });
Parcel.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
Zone.hasMany(Parcel, { foreignKey: 'zoneId', as: 'parcels' });
Driver.hasMany(Parcel, { foreignKey: 'driverId', as: 'parcels' });

export default Parcel;
