/**
 * Jest テストセットアップファイル
 * Chrome拡張機能のAPIやDOM環境をモックします
 */

// Chrome Extension APIのモック
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn()
  }
};

const mockChromeContextMenus = {
  create: jest.fn(),
  removeAll: jest.fn(),
  onClicked: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

const mockChromeTabs = {
  sendMessage: jest.fn()
};

const mockChromeRuntime = {
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// グローバルchromeオブジェクトを設定
global.chrome = {
  storage: mockChromeStorage,
  contextMenus: mockChromeContextMenus,
  tabs: mockChromeTabs,
  runtime: mockChromeRuntime
} as any;

// Web Crypto APIのモック（crypto.randomUUID用）
let mockUuidCounter = 0;
const mockCrypto = {
  randomUUID: jest.fn(() => {
    mockUuidCounter++;
    return `mock-uuid-${mockUuidCounter.toString().padStart(4, '0')}-5678-9abc-def012345678`;
  }),
  getRandomValues: jest.fn((arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  })
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// DOM関連のモック
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// setTimeout/setIntervalのモック（テスト高速化）
jest.useFakeTimers();

// コンソールの警告を抑制（テスト出力をクリーンに）
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  // 各テスト前にモックをリセット
  jest.clearAllMocks();
  
  // UUIDカウンターをリセット
  mockUuidCounter = 0;
  
  // コンソール出力を制御（必要に応じて）
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // コンソールを復元
  console.warn = originalWarn;
  console.error = originalError;
});

// テスト用ヘルパー関数をエクスポート
export const mockHelpers = {
  // Chrome APIモックにアクセスするヘルパー
  getChromeStorageMock: () => mockChromeStorage,
  getChromeContextMenusMock: () => mockChromeContextMenus,
  getChromeTabsMock: () => mockChromeTabs,
  getChromeRuntimeMock: () => mockChromeRuntime,
  
  // テスト用のDOM要素作成ヘルパー
  createMockCheckbox: (id: string, label: string, checked: boolean = false) => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = checked;
    checkbox.setAttribute('aria-label', label);
    return checkbox;
  },
  
  // テスト用のカレンダーグループデータ
  createMockCalendarGroup: (overrides: Partial<any> = {}) => ({
    id: 'test-group-1',
    name: 'テストグループ',
    calendars: ['カレンダー1', 'カレンダー2'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }),
  
  // 非同期テスト用の待機ヘルパー
  waitForNextTick: () => new Promise(resolve => setTimeout(resolve, 0)),
  
  // Promise解決を待つヘルパー
  flushPromises: () => new Promise(resolve => setTimeout(resolve, 0))
};