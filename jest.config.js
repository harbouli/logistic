/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',
  // Set the test environment to Node.js (as opposed to jsdom for browser)
  testEnvironment: 'node',
  // Root directory for looking for tests and modules
  roots: ['<rootDir>/src'],
  // Pattern to find test files: looks for .test.ts files inside __tests__ directories
  testMatch: ['**/__tests__/**/*.test.ts'],
  // File extensions to recognize
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Configure code coverage collection
  collectCoverageFrom: [
    'src/**/*.ts',       // Include all TypeScript files in src
    '!src/**/*.d.ts',    // Exclude type definition files
    '!src/__tests__/**'  // Exclude test files themselves
  ],
  // Directory where coverage reports will be output
  coverageDirectory: 'coverage',
  // distinct detailed information on the run
  verbose: true,
  // Timeout for each test in milliseconds (30 seconds)
  testTimeout: 30000,
  // Path to setup file to run before each test suite
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts']
};
