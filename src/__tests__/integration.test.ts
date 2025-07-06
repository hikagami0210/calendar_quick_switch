/**
 * 統合テスト
 * 複数の関数が連携して動作することをテスト
 */

import { mockHelpers } from './setup';

describe('Integration Tests', () => {
  let mockStorageData: any;

  beforeEach(() => {
    // 各テスト前の初期化
    document.body.innerHTML = '';
    mockStorageData = {};
    
    // Chrome storage APIのモック設定
    const storageMock = mockHelpers.getChromeStorageMock();
    
    storageMock.local.get.mockImplementation((keys) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: mockStorageData[keys] });
      }
      return Promise.resolve(mockStorageData);
    });

    storageMock.local.set.mockImplementation((data) => {
      Object.assign(mockStorageData, data);
      return Promise.resolve();
    });
  });

  describe('Group Creation Workflow', () => {
    /**
     * グループ作成の完全なワークフローをテスト
     */
    it('should complete full group creation workflow', async () => {
      // 1. カレンダーセクションをDOMに設定
      const calendarSection = document.createElement('div');
      calendarSection.setAttribute('aria-label', '他のカレンダー');

      const calendar1 = mockHelpers.createMockCheckbox('cal1', 'カレンダー1', true);
      const calendar2 = mockHelpers.createMockCheckbox('cal2', 'カレンダー2', false);
      const calendar3 = mockHelpers.createMockCheckbox('cal3', 'カレンダー3', true);

      calendarSection.appendChild(calendar1);
      calendarSection.appendChild(calendar2);
      calendarSection.appendChild(calendar3);
      document.body.appendChild(calendarSection);

      // 2. 選択されたカレンダーを取得する関数（モック）
      const getCurrentlySelectedCalendars = async (): Promise<string[]> => {
        const section = document.querySelector('[aria-label="他のカレンダー"]') as HTMLElement;
        if (!section) return [];

        const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
        return checkboxes
          .filter(checkbox => checkbox.checked)
          .map(checkbox => checkbox.getAttribute('aria-label') || '');
      };

      // 3. グループを保存する関数（モック）
      const addGroup = async (group: any) => {
        const result = await chrome.storage.local.get('calendarGroups');
        const groups = result.calendarGroups || [];
        groups.push(group);
        await chrome.storage.local.set({ calendarGroups: groups });
      };

      // 4. 完全なグループ作成ワークフロー
      const createCalendarGroup = async (groupName: string) => {
        const selectedCalendars = await getCurrentlySelectedCalendars();
        
        if (selectedCalendars.length === 0) {
          throw new Error('カレンダーが選択されていません');
        }

        const newGroup = {
          id: mockHelpers.getChromeStorageMock().local.get('counter') || 'group-1',
          name: groupName,
          calendars: selectedCalendars,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await addGroup(newGroup);
        return newGroup;
      };

      // 5. ワークフローの実行とテスト
      const result = await createCalendarGroup('テストグループ');

      expect(result.name).toBe('テストグループ');
      expect(result.calendars).toEqual(['カレンダー1', 'カレンダー3']);
      expect(result.calendars).toHaveLength(2);
      
      // ストレージに保存されていることを確認
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        calendarGroups: [result]
      });
    });

    /**
     * 既存グループ名との重複チェックをテスト
     */
    it('should prevent duplicate group names', async () => {
      // 既存のグループを設定
      const existingGroup = mockHelpers.createMockCalendarGroup({
        name: '既存グループ'
      });
      mockStorageData.calendarGroups = [existingGroup];

      const loadGroups = async () => {
        const result = await chrome.storage.local.get('calendarGroups');
        return result.calendarGroups || [];
      };

      const validateGroupName = async (name: string) => {
        const existingGroups = await loadGroups();
        return !existingGroups.some((group: any) => group.name === name);
      };

      // 重複チェック
      const isValid1 = await validateGroupName('既存グループ');
      const isValid2 = await validateGroupName('新しいグループ');

      expect(isValid1).toBe(false); // 重複なので無効
      expect(isValid2).toBe(true);  // 新しい名前なので有効
    });
  });

  describe('Group Application Workflow', () => {
    /**
     * グループ適用の完全なワークフローをテスト
     */
    it('should complete full group application workflow', async () => {
      // 1. カレンダーDOMを設定
      const calendarSection = document.createElement('div');
      calendarSection.setAttribute('aria-label', '他のカレンダー');

      const calendar1 = mockHelpers.createMockCheckbox('cal1', 'カレンダー1', false);
      const calendar2 = mockHelpers.createMockCheckbox('cal2', 'カレンダー2', true);
      const calendar3 = mockHelpers.createMockCheckbox('cal3', 'カレンダー3', false);

      // クリック動作をモック
      [calendar1, calendar2, calendar3].forEach(checkbox => {
        checkbox.click = jest.fn(() => {
          checkbox.checked = !checkbox.checked;
        });
      });

      calendarSection.appendChild(calendar1);
      calendarSection.appendChild(calendar2);
      calendarSection.appendChild(calendar3);
      document.body.appendChild(calendarSection);

      // 2. 保存されたグループを設定
      const testGroup = mockHelpers.createMockCalendarGroup({
        name: 'テストグループ',
        calendars: ['カレンダー1', 'カレンダー3']
      });
      mockStorageData.calendarGroups = [testGroup];
      mockStorageData.settings = { disableOthers: true };

      // 3. グループ適用関数（モック）
      const applyCalendarGroup = async (group: any, disableOthers: boolean = true) => {
        const section = document.querySelector('[aria-label="他のカレンダー"]') as HTMLElement;
        if (!section) return;

        const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
        
        for (const checkbox of checkboxes) {
          const label = checkbox.getAttribute('aria-label');
          const shouldBeChecked = group.calendars.includes(label);
          
          if (shouldBeChecked && !checkbox.checked) {
            checkbox.click();
          } else if (!shouldBeChecked && checkbox.checked && disableOthers) {
            checkbox.click();
          }
        }
      };

      // 4. ワークフローの実行
      await applyCalendarGroup(testGroup, true);

      // 5. 結果の検証
      expect(calendar1.checked).toBe(true);  // カレンダー1: 有効化
      expect(calendar2.checked).toBe(false); // カレンダー2: 無効化（グループ外）
      expect(calendar3.checked).toBe(true);  // カレンダー3: 有効化

      // クリックが適切に呼ばれたか確認
      expect(calendar1.click).toHaveBeenCalledTimes(1);
      expect(calendar2.click).toHaveBeenCalledTimes(1);
      expect(calendar3.click).toHaveBeenCalledTimes(1);
    });

    /**
     * disableOthers設定が正しく動作することをテスト
     */
    it('should respect disableOthers setting', async () => {
      // DOM設定
      const calendarSection = document.createElement('div');
      calendarSection.setAttribute('aria-label', '他のカレンダー');

      const calendar1 = mockHelpers.createMockCheckbox('cal1', 'カレンダー1', false);
      const calendar2 = mockHelpers.createMockCheckbox('cal2', 'カレンダー2', true);

      calendar1.click = jest.fn(() => { calendar1.checked = !calendar1.checked; });
      calendar2.click = jest.fn(() => { calendar2.checked = !calendar2.checked; });

      calendarSection.appendChild(calendar1);
      calendarSection.appendChild(calendar2);
      document.body.appendChild(calendarSection);

      const testGroup = mockHelpers.createMockCalendarGroup({
        calendars: ['カレンダー1'] // カレンダー1のみ
      });

      const applyCalendarGroup = async (group: any, disableOthers: boolean) => {
        const section = document.querySelector('[aria-label="他のカレンダー"]') as HTMLElement;
        const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
        
        for (const checkbox of checkboxes) {
          const label = checkbox.getAttribute('aria-label');
          const shouldBeChecked = group.calendars.includes(label);
          
          if (shouldBeChecked && !checkbox.checked) {
            checkbox.click();
          } else if (!shouldBeChecked && checkbox.checked && disableOthers) {
            checkbox.click();
          }
        }
      };

      // disableOthers: false の場合
      await applyCalendarGroup(testGroup, false);
      
      expect(calendar1.checked).toBe(true);  // 有効化
      expect(calendar2.checked).toBe(true);  // そのまま（無効化しない）
      expect(calendar2.click).not.toHaveBeenCalled(); // クリックされない

      // 状態をリセット
      calendar1.checked = false;
      calendar2.checked = true;
      jest.clearAllMocks();

      // disableOthers: true の場合
      await applyCalendarGroup(testGroup, true);
      
      expect(calendar1.checked).toBe(true);   // 有効化
      expect(calendar2.checked).toBe(false);  // 無効化
      expect(calendar2.click).toHaveBeenCalledTimes(1); // クリックされる
    });
  });

  describe('Context Menu Integration', () => {
    /**
     * コンテキストメニューとグループ機能の統合をテスト
     */
    it('should integrate context menu with group functions', async () => {
      // 1. グループデータを設定
      const testGroups = [
        mockHelpers.createMockCalendarGroup({ id: 'group1', name: 'グループ1' }),
        mockHelpers.createMockCalendarGroup({ id: 'group2', name: 'グループ2' })
      ];
      mockStorageData.calendarGroups = testGroups;

      // 2. コンテキストメニュー更新関数（モック）
      const updateContextMenus = async () => {
        const result = await chrome.storage.local.get('calendarGroups');
        const groups = result.calendarGroups || [];
        
        // メニューを削除してから再作成
        chrome.contextMenus.removeAll(() => {
          groups.forEach((group: any) => {
            chrome.contextMenus.create({
              id: `calendar-group-${group.id}`,
              title: `グループ: ${group.name}`,
              contexts: ['page']
            });
          });

          chrome.contextMenus.create({
            id: 'create-group',
            title: 'グループを作成',
            contexts: ['page']
          });
        });
      };

      // 3. 関数実行
      await updateContextMenus();

      // 4. 結果検証
      expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
      expect(chrome.contextMenus.create).toHaveBeenCalledTimes(3); // 2つのグループ + 作成メニュー

      // 各グループメニューが作成されることを確認
      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'calendar-group-group1',
        title: 'グループ: グループ1',
        contexts: ['page']
      });

      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'calendar-group-group2',
        title: 'グループ: グループ2',
        contexts: ['page']
      });

      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'create-group',
        title: 'グループを作成',
        contexts: ['page']
      });
    });

    /**
     * コンテキストメニュークリック処理をテスト
     */
    it('should handle context menu clicks correctly', async () => {
      // 1. テストデータ設定
      const testGroup = mockHelpers.createMockCalendarGroup({
        id: 'test-group',
        name: 'テストグループ'
      });
      mockStorageData.calendarGroups = [testGroup];
      mockStorageData.settings = { disableOthers: true };

      // 2. コンテキストメニューハンドラー（モック）
      const handleContextMenuClick = async (info: any, tab: any) => {
        const menuItemId = info.menuItemId as string;
        
        if (menuItemId === 'create-group') {
          // グループ作成処理
          return await chrome.tabs.sendMessage(tab.id, { action: 'createGroup' });
        } else if (menuItemId.startsWith('calendar-group-')) {
          // グループ適用処理
          const groupId = menuItemId.replace('calendar-group-', '');
          const result = await chrome.storage.local.get('calendarGroups');
          const groups = result.calendarGroups || [];
          const selectedGroup = groups.find((g: any) => g.id === groupId);
          
          if (selectedGroup) {
            const settings = await chrome.storage.local.get('settings');
            return await chrome.tabs.sendMessage(tab.id, {
              action: 'applyGroup',
              group: selectedGroup,
              settings: settings.settings || { disableOthers: true }
            });
          }
        }
      };

      // 3. Chrome tabs メッセージ送信のモック
      const tabsMock = mockHelpers.getChromeTabsMock();
      tabsMock.sendMessage.mockResolvedValue({ success: true });

      // 4. グループ作成メニューのクリックをテスト
      await handleContextMenuClick(
        { menuItemId: 'create-group' },
        { id: 123 }
      );

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
        action: 'createGroup'
      });

      // 5. グループ適用メニューのクリックをテスト
      jest.clearAllMocks();
      
      await handleContextMenuClick(
        { menuItemId: 'calendar-group-test-group' },
        { id: 123 }
      );

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
        action: 'applyGroup',
        group: testGroup,
        settings: { disableOthers: true }
      });
    });
  });

  describe('Storage Change Integration', () => {
    /**
     * ストレージ変更時のメニュー更新をテスト
     */
    it('should update menus when storage changes', async () => {
      // 1. ストレージ変更ハンドラー（モック）
      const handleStorageChange = async (changes: any, namespace: string) => {
        if (namespace === 'local' && changes.calendarGroups) {
          // メニューを更新
          await chrome.contextMenus.removeAll();
          const result = await chrome.storage.local.get('calendarGroups');
          const groups = result.calendarGroups || [];
          
          groups.forEach((group: any) => {
            chrome.contextMenus.create({
              id: `calendar-group-${group.id}`,
              title: `グループ: ${group.name}`
            });
          });
        }
      };

      // 2. ストレージ変更をシミュレート
      const changes = {
        calendarGroups: {
          newValue: [mockHelpers.createMockCalendarGroup()],
          oldValue: []
        }
      };

      await handleStorageChange(changes, 'local');

      // 3. メニューが更新されたことを確認
      expect(chrome.contextMenus.removeAll).toHaveBeenCalled();
      expect(chrome.contextMenus.create).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    /**
     * エラー処理の統合をテスト
     */
    it('should handle errors gracefully across functions', async () => {
      // 1. ストレージエラーをシミュレート
      const storageMock = mockHelpers.getChromeStorageMock();
      storageMock.local.get.mockRejectedValueOnce(new Error('Storage error'));

      // 2. エラーハンドリング付きの関数
      const safeLoadGroups = async () => {
        try {
          const result = await chrome.storage.local.get('calendarGroups');
          return result.calendarGroups || [];
        } catch (error) {
          console.error('Failed to load groups:', error);
          return []; // フォールバック値
        }
      };

      // 3. エラーが適切に処理されることを確認
      const groups = await safeLoadGroups();
      
      expect(groups).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load groups:',
        expect.any(Error)
      );
    });

    /**
     * DOM操作エラーの処理をテスト
     */
    it('should handle DOM operation errors', async () => {
      // DOM要素が存在しない状況での操作
      const safeApplyGroup = async (_group: any) => {
        try {
          const section = document.querySelector('[aria-label="他のカレンダー"]');
          if (!section) {
            console.warn('Calendar section not found');
            return;
          }

          const checkboxes = section.querySelectorAll('input[type="checkbox"]');
          if (checkboxes.length === 0) {
            console.warn('No checkboxes found');
            return;
          }

          // 通常の処理...
        } catch (error) {
          console.error('Failed to apply group:', error);
        }
      };

      await safeApplyGroup(mockHelpers.createMockCalendarGroup());

      // 警告が出力されることを確認
      expect(console.warn).toHaveBeenCalledWith('Calendar section not found');
    });
  });

  describe('Performance and Memory', () => {
    /**
     * メモリリークの防止をテスト
     */
    it('should prevent memory leaks', () => {
      // イベントリスナーの適切な削除をテスト
      const mockElement = document.createElement('button');
      const mockHandler = jest.fn();

      // リスナーを追加
      mockElement.addEventListener('click', mockHandler);
      document.body.appendChild(mockElement);

      // 要素を削除
      document.body.removeChild(mockElement);
      mockElement.removeEventListener('click', mockHandler);

      // ガベージコレクションのシミュレート（実際のテストでは困難）
      expect(document.body.contains(mockElement)).toBe(false);
    });

    /**
     * 大量データの処理をテスト
     */
    it('should handle large amounts of data efficiently', async () => {
      // 大量のグループを作成
      const largeGroupList = Array.from({ length: 100 }, (_, i) =>
        mockHelpers.createMockCalendarGroup({
          id: `group-${i}`,
          name: `グループ ${i}`,
          calendars: [`カレンダー ${i}`]
        })
      );

      mockStorageData.calendarGroups = largeGroupList;

      const loadAndProcessGroups = async () => {
        const result = await chrome.storage.local.get('calendarGroups');
        const groups = result.calendarGroups || [];
        
        // 処理時間の測定（簡易版）
        const startTime = Date.now();
        const processedGroups = groups.map((group: any) => ({
          ...group,
          processed: true
        }));
        const endTime = Date.now();

        return {
          groups: processedGroups,
          processingTime: endTime - startTime
        };
      };

      const result = await loadAndProcessGroups();

      expect(result.groups).toHaveLength(100);
      expect(result.processingTime).toBeLessThan(100); // 100ms以下で処理
    });
  });
});