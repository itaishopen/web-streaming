import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^../types$': '<rootDir>/src/types/index.ts',
    '^../utils/(.*)$': '<rootDir>/src/utils/$1',
    '^../composables/(.*)$': '<rootDir>/src/composables/$1',
    '^vue$': '<rootDir>/node_modules/vue/dist/vue.cjs.js',
    '^vue-router$': '<rootDir>/node_modules/vue-router/dist/vue-router.cjs.js',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    }],
  },
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/composables/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
}

export default config
