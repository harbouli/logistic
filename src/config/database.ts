import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'logistima',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000,
    },
});

export async function initializeDatabase(): Promise<void> {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connection established successfully');

        // Sync all models (in development)
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('✅ Database models synchronized');
        }
    } catch (error) {
        console.error('❌ Unable to connect to PostgreSQL:', error);
        throw error;
    }
}

export default sequelize;
