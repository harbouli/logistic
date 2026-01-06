import { Sequelize } from 'sequelize';

// Create a test database connection
const testSequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'logistima_test',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    logging: false,
});

// Global setup before all tests
beforeAll(async () => {
    try {
        await testSequelize.authenticate();
        console.log('✅ Test database connected');
    } catch (error) {
        console.error('❌ Test database connection failed:', error);
    }
});

// Global teardown after all tests
afterAll(async () => {
    try {
        await testSequelize.close();
        console.log('✅ Test database connection closed');
    } catch (error) {
        console.error('Error closing test database:', error);
    }
});

export { testSequelize };
