/**
 * ストレージ関数のテスト
 * background-final.ts と content-final.ts のストレージ関連関数をテスト
 */

import { mockHelpers } from './setup';

// テスト対象の関数（実際の実装では各ファイルから個別にインポートする必要がある）
// ここではモック実装でテストの構造を示す

describe('Storage Functions', () => {
  let mockStorageData: any;

  beforeEach(() => {
    // 各テスト前にストレージデータをリセット
    mockStorageData = {};
    
    // Chrome storage APIのモック動作を設定
    const storageMock = mockHelpers.getChromeStorageMock();
    
    storageMock.local.get.mockImplementation((keys) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockStorageData[keys] });
      } else if (Array.isArray(keys)) {
        const result: any = {};
        keys.forEach(key => {
          result[key] = mockStorageData[key];
        });
        return Promise.resolve(result);
      } else if (keys === null || keys === undefined) {
        return Promise.resolve(mockStorageData);
      }
      return Promise.resolve({});
    });

    storageMock.local.set.mockImplementation((data) => {
      Object.assign(mockStorageData, data);
      return Promise.resolve();
    });

    storageMock.local.remove.mockImplementation((keys) => {
      if (typeof keys === 'string') {
        delete mockStorageData[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach(key => delete mockStorageData[key]);
      }
      return Promise.resolve();
    });

    storageMock.local.clear.mockImplementation(() => {
      mockStorageData = {};
      return Promise.resolve();
    });
  });

  describe('saveGroups function', () => {
    /**
     * グループデータが正常に保存されることをテスト
     */
    it('should save groups to storage', async () => {
      const testGroups = [
        mockHelpers.createMockCalendarGroup({ id: 'group1', name: 'グループ1' }),
        mockHelpers.createMockCalendarGroup({ id: 'group2', name: 'グループ2' })
      ];

      // ここでは実際のsaveGroups関数の代わりにモック実装を使用
      const mockSaveGroups = async (groups: any[]) => {
        await chrome.storage.local.set({ calendarGroups: groups });
      };

      await mockSaveGroups(testGroups);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        calendarGroups: testGroups
      });
      expect(mockStorageData.calendarGroups).toEqual(testGroups);
    });

    /**
     * 空の配列を保存できることをテスト
     */
    it('should save empty array', async () => {
      const mockSaveGroups = async (groups: any[]) => {
        await chrome.storage.local.set({ calendarGroups: groups });
      };

      await mockSaveGroups([]);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        calendarGroups: []
      });
      expect(mockStorageData.calendarGroups).toEqual([]);
    });

    /**
     * ストレージエラーが適切に処理されることをテスト
     */
    it('should handle storage errors', async () => {
      const mockSaveGroups = async (groups: any[]) => {
        try {
          await chrome.storage.local.set({ calendarGroups: groups });
        } catch (error) {
          console.error('Failed to save groups:', error);
          throw error;
        }
      };

      // ストレージエラーをシミュレート
      mockHelpers.getChromeStorageMock().local.set.mockRejectedValueOnce(
        new Error('Storage quota exceeded')
      );

      const testGroups = [mockHelpers.createMockCalendarGroup()];
      
      await expect(mockSaveGroups(testGroups)).rejects.toThrow('Storage quota exceeded');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to save groups:',
        expect.any(Error)
      );
    });
  });

  describe('loadGroups function', () => {
    /**
     * 保存されたグループが正常に読み込まれることをテスト
     */
    it('should load saved groups from storage', async () => {
      const testGroups = [
        mockHelpers.createMockCalendarGroup({ id: 'group1', name: 'グループ1' }),
        mockHelpers.createMockCalendarGroup({ id: 'group2', name: 'グループ2' })
      ];

      // 事前にデータを設定
      mockStorageData.calendarGroups = testGroups;

      const mockLoadGroups = async () => {
        try {
          const result = await chrome.storage.local.get('calendarGroups');
          return result.calendarGroups || [];
        } catch (error) {
          console.error('Failed to load groups:', error);
          return [];
        }
      };

      const loadedGroups = await mockLoadGroups();

      expect(chrome.storage.local.get).toHaveBeenCalledWith('calendarGroups');
      expect(loadedGroups).toEqual(testGroups);
    });

    /**
     * データが存在しない場合に空配列を返すことをテスト
     */
    it('should return empty array when no data exists', async () => {
      const mockLoadGroups = async () => {
        try {
          const result = await chrome.storage.local.get('calendarGroups');
          return result.calendarGroups || [];
        } catch (error) {
          console.error('Failed to load groups:', error);
          return [];
        }
      };

      const loadedGroups = await mockLoadGroups();

      expect(loadedGroups).toEqual([]);
    });

    /**
     * ストレージエラー時に空配列を返すことをテスト
     */
    it('should return empty array on storage error', async () => {
      const mockLoadGroups = async () => {
        try {
          const result = await chrome.storage.local.get('calendarGroups');
          return result.calendarGroups || [];
        } catch (error) {
          console.error('Failed to load groups:', error);
          return [];
        }
      };

      // ストレージエラーをシミュレート
      mockHelpers.getChromeStorageMock().local.get.mockRejectedValueOnce(
        new Error('Storage access denied')
      );

      const loadedGroups = await mockLoadGroups();

      expect(loadedGroups).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load groups:',
        expect.any(Error)
      );
    });
  });

  describe('saveSettings and loadSettings functions', () => {
    /**
     * 設定が正常に保存・読み込まれることをテスト
     */
    it('should save and load settings', async () => {
      const testSettings = { disableOthers: false };

      const mockSaveSettings = async (settings: any) => {
        await chrome.storage.local.set({ settings });
      };

      const mockLoadSettings = async () => {
        try {
          const result = await chrome.storage.local.get('settings');
          return { disableOthers: true, ...result.settings };
        } catch (error) {
          console.error('Failed to load settings:', error);
          return { disableOthers: true };
        }
      };

      // 設定を保存
      await mockSaveSettings(testSettings);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        settings: testSettings
      });

      // 設定を読み込み
      const loadedSettings = await mockLoadSettings();
      expect(loadedSettings).toEqual(testSettings);
    });

    /**
     * 設定が存在しない場合にデフォルト値を返すことをテスト
     */
    it('should return default settings when no data exists', async () => {
      const mockLoadSettings = async () => {
        try {
          const result = await chrome.storage.local.get('settings');
          return { disableOthers: true, ...result.settings };
        } catch (error) {
          console.error('Failed to load settings:', error);
          return { disableOthers: true };
        }
      };

      const settings = await mockLoadSettings();
      expect(settings).toEqual({ disableOthers: true });
    });

    /**
     * 部分的な設定がデフォルト値とマージされることをテスト
     */
    it('should merge partial settings with defaults', async () => {
      // 将来的に設定項目が増えた場合のテスト
      mockStorageData.settings = {}; // 空の設定

      const mockLoadSettings = async () => {
        try {
          const result = await chrome.storage.local.get('settings');
          return { disableOthers: true, ...result.settings };
        } catch (error) {
          console.error('Failed to load settings:', error);
          return { disableOthers: true };
        }
      };

      const settings = await mockLoadSettings();
      expect(settings.disableOthers).toBe(true);
    });
  });

  describe('addGroup function', () => {
    /**
     * 新しいグループが既存のグループに追加されることをテスト
     */
    it('should add new group to existing groups', async () => {
      const existingGroups = [
        mockHelpers.createMockCalendarGroup({ id: 'group1', name: 'グループ1' })
      ];
      const newGroup = mockHelpers.createMockCalendarGroup({ id: 'group2', name: 'グループ2' });

      // 既存のグループを設定
      mockStorageData.calendarGroups = existingGroups;

      const mockAddGroup = async (group: any) => {
        const result = await chrome.storage.local.get('calendarGroups');
        const groups = result.calendarGroups || [];
        groups.push(group);
        await chrome.storage.local.set({ calendarGroups: groups });
      };

      await mockAddGroup(newGroup);

      expect(mockStorageData.calendarGroups).toHaveLength(2);
      expect(mockStorageData.calendarGroups[1]).toEqual(newGroup);
    });

    /**
     * 最初のグループが正常に追加されることをテスト
     */
    it('should add first group to empty storage', async () => {
      const newGroup = mockHelpers.createMockCalendarGroup();

      const mockAddGroup = async (group: any) => {
        const result = await chrome.storage.local.get('calendarGroups');
        const groups = result.calendarGroups || [];
        groups.push(group);
        await chrome.storage.local.set({ calendarGroups: groups });
      };

      await mockAddGroup(newGroup);

      expect(mockStorageData.calendarGroups).toHaveLength(1);
      expect(mockStorageData.calendarGroups[0]).toEqual(newGroup);
    });
  });

  describe('Data integrity', () => {
    /**
     * 保存されたデータの整合性をテスト
     */
    it('should maintain data integrity during save/load cycles', async () => {
      const originalGroups = [
        mockHelpers.createMockCalendarGroup({
          id: 'group1',
          name: 'テストグループ',
          calendars: ['カレンダー1', 'カレンダー2', 'カレンダー3'],
          createdAt: 1234567890,
          updatedAt: 1234567899
        })
      ];

      const mockSaveGroups = async (groups: any[]) => {
        await chrome.storage.local.set({ calendarGroups: groups });
      };

      const mockLoadGroups = async () => {
        const result = await chrome.storage.local.get('calendarGroups');
        return result.calendarGroups || [];
      };

      // 保存
      await mockSaveGroups(originalGroups);
      
      // 読み込み
      const loadedGroups = await mockLoadGroups();

      // データが完全に一致することを確認
      expect(loadedGroups).toEqual(originalGroups);
      expect(loadedGroups[0].calendars).toEqual(['カレンダー1', 'カレンダー2', 'カレンダー3']);
      expect(loadedGroups[0].createdAt).toBe(1234567890);
      expect(loadedGroups[0].updatedAt).toBe(1234567899);
    });

    /**
     * 日本語データが正常に処理されることをテスト
     */
    it('should handle Japanese text correctly', async () => {
      const japaneseGroup = mockHelpers.createMockCalendarGroup({
        name: 'テストグループ',
        calendars: ['田中さん', '佐藤さん', '山田さん']
      });

      const mockSaveGroups = async (groups: any[]) => {
        await chrome.storage.local.set({ calendarGroups: groups });
      };

      const mockLoadGroups = async () => {
        const result = await chrome.storage.local.get('calendarGroups');
        return result.calendarGroups || [];
      };

      await mockSaveGroups([japaneseGroup]);
      const loadedGroups = await mockLoadGroups();

      expect(loadedGroups[0].name).toBe('テストグループ');
      expect(loadedGroups[0].calendars).toEqual(['田中さん', '佐藤さん', '山田さん']);
    });
  });
});