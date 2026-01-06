import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Parcel from './Parcel';
import Driver from './Driver';

export type DeliveryStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface DeliveryAttributes {
    id: string;
    parcelId: string;
    driverId: string;
    status: DeliveryStatus;
    estimatedRoute?: string | null;
    receiptGenerated: boolean;
    startedAt?: Date | null;
    completedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface DeliveryCreationAttributes extends Optional<DeliveryAttributes, 'id' | 'status' | 'estimatedRoute' | 'receiptGenerated' | 'startedAt' | 'completedAt'> { }

class Delivery extends Model<DeliveryAttributes, DeliveryCreationAttributes> implements DeliveryAttributes {
    declare id: string;
    declare parcelId: string;
    declare driverId: string;
    declare status: DeliveryStatus;
    declare estimatedRoute: string | null;
    declare receiptGenerated: boolean;
    declare startedAt: Date | null;
    declare completedAt: Date | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

Delivery.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        parcelId: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true, // One delivery per parcel
            references: {
                model: 'parcels',
                key: 'id',
            },
        },
        driverId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'drivers',
                key: 'id',
            },
        },
        status: {
            type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'pending',
        },
        estimatedRoute: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        receiptGenerated: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        startedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        completedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'deliveries',
        timestamps: true,
        indexes: [
            {
                fields: ['status'],
            },
            {
                fields: ['parcelId'],
                unique: true,
            },
            {
                fields: ['driverId'],
            },
        ],
    }
);

// Associations
Delivery.belongsTo(Parcel, { foreignKey: 'parcelId', as: 'parcel' });
Delivery.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
Parcel.hasOne(Delivery, { foreignKey: 'parcelId', as: 'delivery' });
Driver.hasMany(Delivery, { foreignKey: 'driverId', as: 'deliveries' });

export default Delivery;
