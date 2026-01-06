import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Zone from './Zone';

export type DriverStatus = 'available' | 'busy' | 'offline';

interface DriverAttributes {
    id: string;
    name: string;
    phone: string;
    latitude: number;
    longitude: number;
    capacity: number;
    status: DriverStatus;
    zoneId: string;
    createdAt?: Date;
    updatedAt?: Date;
}

interface DriverCreationAttributes extends Optional<DriverAttributes, 'id' | 'status'> { }

class Driver extends Model<DriverAttributes, DriverCreationAttributes> implements DriverAttributes {
    declare id: string;
    declare name: string;
    declare phone: string;
    declare latitude: number;
    declare longitude: number;
    declare capacity: number;
    declare status: DriverStatus;
    declare zoneId: string;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    // Check if driver has capacity for more parcels
    hasCapacity(): boolean {
        return this.capacity > 0 && this.status === 'available';
    }
}

Driver.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false,
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false,
        },
        capacity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5,
            validate: {
                min: 0,
            },
        },
        status: {
            type: DataTypes.ENUM('available', 'busy', 'offline'),
            allowNull: false,
            defaultValue: 'available',
        },
        zoneId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'zones',
                key: 'id',
            },
        },
    },
    {
        sequelize,
        tableName: 'drivers',
        timestamps: true,
        indexes: [
            {
                fields: ['status'],
            },
            {
                fields: ['zoneId'],
            },
            {
                fields: ['capacity'],
            },
        ],
    }
);

// Associations
Driver.belongsTo(Zone, { foreignKey: 'zoneId', as: 'zone' });
Zone.hasMany(Driver, { foreignKey: 'zoneId', as: 'drivers' });

export default Driver;
