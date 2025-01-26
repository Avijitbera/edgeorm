// Jest setup file

// Reset all mocks after each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Add custom matchers if needed
expect.extend({
  // Add custom matchers here if required
});

// Global test timeout (optional)
jest.setTimeout(10000); // 10 seconds

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});