module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup.js"],
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/lib/prisma.js",
  ],
  coverageDirectory: "coverage",
  ...(process.env.CI
    ? {
        coverageThreshold: {
          global: {
            branches: 50,
            functions: 60,
            lines: 60,
            statements: 60,
          },
        },
      }
    : {}),
};
