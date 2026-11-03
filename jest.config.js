/**
 * Cấu hình Jest cho Next.js App Router.
 *
 * - Chạy trong môi trường Node vì các Server Action chỉ dùng API server.
 * - `ts-jest` biên dịch TypeScript trực tiếp, không cần build Next.js trước.
 * - `moduleNameMapper` tái hiện alias `@/*` trong tsconfig.json.
 * - Mock Prisma / session / audit / crypto ở từng test để không cần DB thật.
 */

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  collectCoverageFrom: [
    "src/actions/blood-donation.ts",
    "src/lib/donation-rules.ts",
    "src/lib/validations.ts",
  ],
  coverageDirectory: "coverage",
};
