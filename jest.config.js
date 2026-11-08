module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  collectCoverage: true,
  coverageDirectory: 'reports/coverage',
  coverageReporters: ['json-summary', 'html', 'text-summary'],
  coverageThreshold: {
    global: { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
};
