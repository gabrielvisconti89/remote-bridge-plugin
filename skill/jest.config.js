module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'handlers/**/*.js',
    'utils/**/*.js',
    'server.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 20,
      lines: 25,
      statements: 25,
    },
  },
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['./tests/setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
};
