import { Sequelize } from 'sequelize';

// Create a test database connection instance using Sequelize
// This configuration uses environment variables or defaults to local postgres settings
const testSequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'logistima_test',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    logging: false, // Disable SQL query logging during tests for cleaner output
});

// Global setup hook: Runs once before all tests in the suite
beforeAll(async () => {
    try {
        // Verify database connection is working
        await testSequelize.authenticate();
        console.log('✅ Test database connected');
    } catch (error) {
        console.error('❌ Test database connection failed:', error);
    }
});

// Global teardown hook: Runs once after all tests in the suite have finished
afterAll(async () => {
    try {
        // Close the database connection to prevent open handles
        await testSequelize.close();
        console.log('✅ Test database connection closed');
    } catch (error) {
        console.error('Error closing test database:', error);
    }
});

// Export the sequelize instance for use in tests if needed
export { testSequelize };
