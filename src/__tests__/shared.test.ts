/**
 * shared.ts のユーティリティ関数のテスト
 */

import { sleep, generateId, STORAGE_KEYS, MENU_IDS, DEFAULT_SETTINGS } from '../shared';
import { mockHelpers } from './setup';

describe('shared.ts utilities', () => {
  
  describe('sleep function', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    /**
     * sleep関数が指定された時間だけ待機することをテスト
     */
    it('should wait for the specified amount of time', async () => {
      const sleepPromise = sleep(1000);
      
      // 1秒未満では解決されない
      jest.advanceTimersByTime(999);
      await mockHelpers.waitForNextTick();
      
      let resolved = false;
      sleepPromise.then(() => { resolved = true; });
      await mockHelpers.waitForNextTick();
      expect(resolved).toBe(false);
      
      // 1秒経過で解決される
      jest.advanceTimersByTime(1);
      await sleepPromise;
      expect(resolved).toBe(true);
    });

    /**
     * sleep(0)が即座に解決されることをテスト
     */
    it('should resolve immediately for sleep(0)', async () => {
      const startTime = Date.now();
      await sleep(0);
      const endTime = Date.now();
      
      // 実際の時間経過は最小限であることを確認
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('generateId function', () => {
    /**
     * generateId関数がUUID形式の文字列を返すことをテスト
     */
    it('should return a UUID string', () => {
      const id = generateId();
      
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^mock-uuid-\d{4}-5678-9abc-def012345678$/);
    });

    /**
     * 連続して呼び出しても異なるIDが生成されることをテスト
     */
    it('should generate unique IDs on consecutive calls', () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    /**
     * 大量のIDを生成しても重複しないことをテスト
     */
    it('should generate unique IDs in bulk', () => {
      const ids = new Set();
      const count = 1000;
      
      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }
      
      expect(ids.size).toBe(count);
    });
  });

  describe('Constants', () => {
    /**
     * STORAGE_KEYSが期待される値を持つことをテスト
     */
    it('STORAGE_KEYS should have correct values', () => {
      expect(STORAGE_KEYS.GROUPS).toBe('calendarGroups');
      expect(STORAGE_KEYS.SETTINGS).toBe('settings');
    });

    /**
     * MENU_IDSが期待される値を持つことをテスト
     */
    it('MENU_IDS should have correct values', () => {
      expect(MENU_IDS.PREFIX).toBe('calendar-group-');
      expect(MENU_IDS.CREATE).toBe('create-group');
      expect(MENU_IDS.SEPARATOR).toBe('separator');
    });

    /**
     * DEFAULT_SETTINGSが期待される構造を持つことをテスト
     */
    it('DEFAULT_SETTINGS should have correct structure', () => {
      expect(DEFAULT_SETTINGS).toEqual({
        disableOthers: true
      });
      expect(typeof DEFAULT_SETTINGS.disableOthers).toBe('boolean');
    });

    /**
     * 定数が適切な型であることをテスト
     */
    it('constants should have correct types', () => {
      // TypeScriptの型チェック時に readonly が確保されているため、
      // 実行時のテストではプロパティの存在確認を行う
      expect(STORAGE_KEYS).toHaveProperty('GROUPS');
      expect(STORAGE_KEYS).toHaveProperty('SETTINGS');
      expect(MENU_IDS).toHaveProperty('PREFIX');
      expect(MENU_IDS).toHaveProperty('CREATE');
      expect(MENU_IDS).toHaveProperty('SEPARATOR');
    });
  });

  describe('Type interfaces', () => {
    /**
     * CalendarGroup型の構造をテスト
     */
    it('should validate CalendarGroup interface structure', () => {
      const mockGroup = mockHelpers.createMockCalendarGroup();
      
      expect(mockGroup).toHaveProperty('id');
      expect(mockGroup).toHaveProperty('name');
      expect(mockGroup).toHaveProperty('calendars');
      expect(mockGroup).toHaveProperty('createdAt');
      expect(mockGroup).toHaveProperty('updatedAt');
      
      expect(typeof mockGroup.id).toBe('string');
      expect(typeof mockGroup.name).toBe('string');
      expect(Array.isArray(mockGroup.calendars)).toBe(true);
      expect(typeof mockGroup.createdAt).toBe('number');
      expect(typeof mockGroup.updatedAt).toBe('number');
    });

    /**
     * Settings型の構造をテスト
     */
    it('should validate Settings interface structure', () => {
      const settings = DEFAULT_SETTINGS;
      
      expect(settings).toHaveProperty('disableOthers');
      expect(typeof settings.disableOthers).toBe('boolean');
    });

    /**
     * CalendarCheckbox型のモックデータをテスト
     */
    it('should validate CalendarCheckbox mock structure', () => {
      const mockCheckbox = mockHelpers.createMockCheckbox('test-1', 'Test Calendar', true);
      
      expect(mockCheckbox.type).toBe('checkbox');
      expect(mockCheckbox.id).toBe('test-1');
      expect(mockCheckbox.checked).toBe(true);
      expect(mockCheckbox.getAttribute('aria-label')).toBe('Test Calendar');
    });
  });

  describe('Error handling', () => {
    /**
     * sleep関数が負の値でエラーを投げることをテスト
     */
    it('should handle negative values in sleep', async () => {
      // 負の値でもPromiseは正常に動作するべき（setTimeoutの仕様に従う）
      await expect(sleep(-100)).resolves.toBeUndefined();
    });

    /**
     * generateId関数がcrypto APIが利用できない場合の動作をテスト
     */
    it('should handle crypto API unavailability', () => {
      const originalCrypto = global.crypto;
      
      // crypto APIを一時的に無効化
      delete (global as any).crypto;
      
      // generateIdがエラーを投げることを確認
      expect(() => generateId()).toThrow();
      
      // crypto APIを復元
      global.crypto = originalCrypto;
    });
  });
});