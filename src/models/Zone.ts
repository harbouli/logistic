import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ZoneAttributes {
    id: string;
    name: string;
    centerLat: number;
    centerLng: number;
    radius: number; // in kilometers
    createdAt?: Date;
    updatedAt?: Date;
}

interface ZoneCreationAttributes extends Optional<ZoneAttributes, 'id'> { }

class Zone extends Model<ZoneAttributes, ZoneCreationAttributes> implements ZoneAttributes {
    declare id: string;
    declare name: string;
    declare centerLat: number;
    declare centerLng: number;
    declare radius: number;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
}

Zone.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        centerLat: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false,
        },
        centerLng: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false,
        },
        radius: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            defaultValue: 5.0, // 5km default radius
        },
    },
    {
        sequelize,
        tableName: 'zones',
        timestamps: true,
        indexes: [
            {
                fields: ['name'],
            },
        ],
    }
);

export default Zone;
