/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/features/occurrences/**/*.{ts,tsx}',
    '!src/features/occurrences/**/*.test.{ts,tsx}',
    '!src/features/occurrences/services/api/ApiOccurrenceService.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  clearMocks: true,
};
