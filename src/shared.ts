/**
 * Google カレンダーグループ拡張機能 - 共通定義
 * バックグラウンドスクリプトとコンテンツスクリプトで共有される型定義と定数
 */

// ===== 型定義 =====

export interface CalendarGroup {
  id: string;
  name: string;
  calendars: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CalendarCheckbox {
  element: HTMLInputElement;
  label: string;
  checked: boolean;
}

export interface Settings {
  disableOthers: boolean;
}

// ===== 定数 =====

export const STORAGE_KEYS = {
  GROUPS: 'calendarGroups',
  SETTINGS: 'settings'
} as const;

export const DEFAULT_SETTINGS: Settings = {
  disableOthers: true
};

export const MENU_IDS = {
  PREFIX: 'calendar-group-',
  CREATE: 'create-group',
  SEPARATOR: 'separator'
} as const;

// ===== ユーティリティ関数 =====

/**
 * 指定されたミリ秒間待機します
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ユニークIDを生成します
 * @returns {string} 生成されたID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}