/**
 * Jest configuration for Chrome extension testing
 */

module.exports = {
  // テスト環境
  testEnvironment: 'jsdom',
  
  // TypeScriptサポート
  preset: 'ts-jest',
  
  // テストファイルのパターン
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  
  // モジュールパスマッピング
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // カバレッジ設定
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/background-final.ts', // Chrome API依存のため除外
    '!src/content-final.ts' // DOM依存のため除外
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
  
  // モック
  clearMocks: true,
  restoreMocks: true,
  
  // タイムアウト
  testTimeout: 10000,
  
  // トランスフォーム設定
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // グローバル設定
  globals: {
    'ts-jest': {
      tsconfig: {
        target: 'ES2020',
        module: 'CommonJS',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  }
};