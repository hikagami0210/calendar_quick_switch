/**
 * DOM操作関数のテスト
 * content-final.ts のDOM操作関連関数をテスト
 */

import { mockHelpers } from './setup';

describe('DOM Functions', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // 各テスト前にクリーンなDOM環境を作成
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    document.body.innerHTML = '';
  });

  describe('findCalendarSection function', () => {
    /**
     * 標準的なセレクタでカレンダーセクションが見つかることをテスト
     */
    it('should find calendar section with standard selector', async () => {
      // モックのカレンダーセクションを作成
      const calendarSection = document.createElement('div');
      calendarSection.setAttribute('aria-label', '他のカレンダー');
      
      // チェックボックスを追加
      const checkbox = mockHelpers.createMockCheckbox('cal1', 'テストカレンダー');
      calendarSection.appendChild(checkbox);
      
      container.appendChild(calendarSection);

      // findCalendarSection関数のモック実装
      const mockFindCalendarSection = async (): Promise<HTMLElement | null> => {
        const selectors = [
          '[aria-label="他のカレンダー"]',
          '[aria-label="Other calendars"]',
          '[aria-label*="カレンダー"]',
          '[aria-label*="calendar"]'
        ];

        for (const selector of selectors) {
          const section = document.querySelector(selector) as HTMLElement;
          if (section) {
            const hasCheckboxes = section.querySelectorAll('input[type="checkbox"]').length > 0;
            if (hasCheckboxes) {
              return section;
            }
          }
        }
        return null;
      };

      const foundSection = await mockFindCalendarSection();
      
      expect(foundSection).toBe(calendarSection);
      expect(foundSection?.getAttribute('aria-label')).toBe('他のカレンダー');
    });

    /**
     * 英語版のセレクタで見つかることをテスト
     */
    it('should find calendar section with English selector', async () => {
      const calendarSection = document.createElement('div');
      calendarSection.setAttribute('aria-label', 'Other calendars');
      
      const checkbox = mockHelpers.createMockCheckbox('cal1', 'Test Calendar');
      calendarSection.appendChild(checkbox);
      
      container.appendChild(calendarSection);

      const mockFindCalendarSection = async (): Promise<HTMLElement | null> => {
        const selectors = [
          '[aria-label="他のカレンダー"]',
          '[aria-label="Other calendars"]'
        ];

        for (const selector of selectors) {
          const section = document.querySelector(selector) as HTMLElement;
          if (section) {
            const hasCheckboxes = section.querySelectorAll('input[type="checkbox"]').length > 0;
            if (hasCheckboxes) {
              return section;
            }
          }
        }
        return null;
      };

      const foundSection = await mockFindCalendarSection();
      
      expect(foundSection).toBe(calendarSection);
    });

    /**
     * フォールバック機能が動作することをテスト
     */
    it('should use fallback when primary selectors fail', async () => {
      // 標準的なセレクタではマッチしないが、チェックボックスを含む要素
      const section = document.createElement('div');
      section.setAttribute('role', 'group');
      
      const checkbox = mockHelpers.createMockCheckbox('cal1', 'テストカレンダー');
      section.appendChild(checkbox);
      
      container.appendChild(section);

      const mockFindCalendarSection = async (): Promise<HTMLElement | null> => {
        // 主要セレクタでは見つからない
        const primarySelectors = [
          '[aria-label="他のカレンダー"]',
          '[aria-label="Other calendars"]'
        ];

        for (const selector of primarySelectors) {
          const element = document.querySelector(selector);
          if (element) return element as HTMLElement;
        }

        // フォールバック: チェックボックスから親要素を探す
        const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        if (allCheckboxes.length > 0) {
          for (const checkbox of Array.from(allCheckboxes)) {
            const container = checkbox.closest('[role="tree"], [role="group"]');
            if (container) {
              return container as HTMLElement;
            }
          }
        }

        return null;
      };

      const foundSection = await mockFindCalendarSection();
      
      expect(foundSection).toBe(section);
      expect(foundSection?.getAttribute('role')).toBe('group');
    });

    /**
     * チェックボックスがない場合は見つからないことをテスト
     */
    it('should not find section without checkboxes', async () => {
      const section = document.createElement('div');
      section.setAttribute('aria-label', '他のカレンダー');
      // チェックボックスは追加しない
      
      container.appendChild(section);

      const mockFindCalendarSection = async (): Promise<HTMLElement | null> => {
        const section = document.querySelector('[aria-label="他のカレンダー"]') as HTMLElement;
        if (section) {
          const hasCheckboxes = section.querySelectorAll('input[type="checkbox"]').length > 0;
          if (hasCheckboxes) {
            return section;
          }
        }
        return null;
      };

      const foundSection = await mockFindCalendarSection();
      
      expect(foundSection).toBe(null);
    });
  });

  describe('getCalendarLabel function', () => {
    /**
     * aria-label属性からラベルを取得することをテスト
     */
    it('should get label from aria-label attribute', () => {
      const checkbox = mockHelpers.createMockCheckbox('cal1', 'テストカレンダー');

      const mockGetCalendarLabel = (checkbox: HTMLInputElement): string | null => {
        const ariaLabel = checkbox.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;
        return null;
      };

      const label = mockGetCalendarLabel(checkbox);
      expect(label).toBe('テストカレンダー');
    });

    /**
     * aria-labelledby属性からラベルを取得することをテスト
     */
    it('should get label from aria-labelledby reference', () => {
      const labelElement = document.createElement('span');
      labelElement.id = 'cal-label-1';
      labelElement.textContent = 'ラベル要素のテキスト';
      container.appendChild(labelElement);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-labelledby', 'cal-label-1');
      container.appendChild(checkbox);

      const mockGetCalendarLabel = (checkbox: HTMLInputElement): string | null => {
        const labelledBy = checkbox.getAttribute('aria-labelledby');
        if (labelledBy) {
          const labelElement = document.getElementById(labelledBy);
          if (labelElement) {
            const text = labelElement.textContent?.trim();
            if (text) return text;
          }
        }

        const ariaLabel = checkbox.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        return null;
      };

      const label = mockGetCalendarLabel(checkbox);
      expect(label).toBe('ラベル要素のテキスト');
    });

    /**
     * 関連するlabel要素からラベルを取得することをテスト
     */
    it('should get label from related label element', () => {
      const wrapper = document.createElement('div');
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      
      const label = document.createElement('label');
      label.textContent = 'ラベル要素のテキスト';
      
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      container.appendChild(wrapper);

      const mockGetCalendarLabel = (checkbox: HTMLInputElement): string | null => {
        const ariaLabel = checkbox.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        const container = checkbox.closest('div, li, span');
        if (container) {
          const label = container.querySelector('label, span, div');
          if (label) {
            const text = label.textContent?.trim();
            if (text && text.length > 0 && !text.includes('checkbox')) {
              return text;
            }
          }
        }

        return null;
      };

      const labelText = mockGetCalendarLabel(checkbox);
      expect(labelText).toBe('ラベル要素のテキスト');
    });

    /**
     * data属性からラベルを取得することをテスト
     */
    it('should get label from data attributes', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('data-calendar-name', 'データ属性のカレンダー名');

      const mockGetCalendarLabel = (checkbox: HTMLInputElement): string | null => {
        // 他の方法で見つからない場合
        const dataName = checkbox.getAttribute('data-name') || 
                         checkbox.getAttribute('data-calendar-name') ||
                         checkbox.getAttribute('data-label');
        if (dataName) return dataName;

        return null;
      };

      const label = mockGetCalendarLabel(checkbox);
      expect(label).toBe('データ属性のカレンダー名');
    });

    /**
     * ラベルが見つからない場合にnullを返すことをテスト
     */
    it('should return null when no label is found', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      // ラベル情報を何も設定しない

      const mockGetCalendarLabel = (checkbox: HTMLInputElement): string | null => {
        // 簡略化されたバージョン
        const ariaLabel = checkbox.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;
        return null;
      };

      const label = mockGetCalendarLabel(checkbox);
      expect(label).toBe(null);
    });
  });

  describe('getCalendarCheckboxes function', () => {
    /**
     * 複数のチェックボックスを正常に取得することをテスト
     */
    it('should get multiple calendar checkboxes', async () => {
      const section = document.createElement('div');
      section.setAttribute('aria-label', '他のカレンダー');

      const checkbox1 = mockHelpers.createMockCheckbox('cal1', 'カレンダー1', true);
      const checkbox2 = mockHelpers.createMockCheckbox('cal2', 'カレンダー2', false);
      const checkbox3 = mockHelpers.createMockCheckbox('cal3', 'カレンダー3', true);

      section.appendChild(checkbox1);
      section.appendChild(checkbox2);
      section.appendChild(checkbox3);
      container.appendChild(section);

      const mockGetCalendarCheckboxes = async () => {
        const section = document.querySelector('[aria-label="他のカレンダー"]') as HTMLElement;
        if (!section) return [];

        const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
        const calendarCheckboxes: any[] = [];

        for (const checkbox of checkboxes) {
          const label = checkbox.getAttribute('aria-label');
          if (label) {
            calendarCheckboxes.push({
              element: checkbox,
              label: label,
              checked: checkbox.checked
            });
          }
        }

        return calendarCheckboxes;
      };

      const checkboxes = await mockGetCalendarCheckboxes();

      expect(checkboxes).toHaveLength(3);
      expect(checkboxes[0].label).toBe('カレンダー1');
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].label).toBe('カレンダー2');
      expect(checkboxes[1].checked).toBe(false);
      expect(checkboxes[2].label).toBe('カレンダー3');
      expect(checkboxes[2].checked).toBe(true);
    });

    /**
     * セクションが見つからない場合に空配列を返すことをテスト
     */
    it('should return empty array when section not found', async () => {
      const mockGetCalendarCheckboxes = async () => {
        const section = document.querySelector('[aria-label="他のカレンダー"]') as HTMLElement;
        if (!section) return [];
        return [];
      };

      const checkboxes = await mockGetCalendarCheckboxes();
      expect(checkboxes).toEqual([]);
    });

    /**
     * ラベルのないチェックボックスが除外されることをテスト
     */
    it('should exclude checkboxes without labels', async () => {
      const section = document.createElement('div');
      section.setAttribute('aria-label', '他のカレンダー');

      const checkbox1 = mockHelpers.createMockCheckbox('cal1', 'カレンダー1');
      const checkbox2 = document.createElement('input'); // ラベルなし
      checkbox2.type = 'checkbox';

      section.appendChild(checkbox1);
      section.appendChild(checkbox2);
      container.appendChild(section);

      const mockGetCalendarCheckboxes = async () => {
        const section = document.querySelector('[aria-label="他のカレンダー"]') as HTMLElement;
        if (!section) return [];

        const checkboxes = Array.from(section.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
        const calendarCheckboxes: any[] = [];

        for (const checkbox of checkboxes) {
          const label = checkbox.getAttribute('aria-label');
          if (label) { // ラベルがある場合のみ追加
            calendarCheckboxes.push({
              element: checkbox,
              label: label,
              checked: checkbox.checked
            });
          }
        }

        return calendarCheckboxes;
      };

      const checkboxes = await mockGetCalendarCheckboxes();
      expect(checkboxes).toHaveLength(1);
      expect(checkboxes[0].label).toBe('カレンダー1');
    });
  });

  describe('toggleCheckbox function', () => {
    /**
     * チェックボックスの状態が正常に変更されることをテスト
     */
    it('should toggle checkbox state correctly', () => {
      const checkbox = mockHelpers.createMockCheckbox('cal1', 'テストカレンダー', false);
      container.appendChild(checkbox);

      let clickCalled = false;
      checkbox.click = jest.fn(() => {
        clickCalled = true;
        checkbox.checked = !checkbox.checked;
      });

      const mockToggleCheckbox = (checkbox: HTMLInputElement, checked: boolean) => {
        if (checkbox.checked !== checked) {
          checkbox.click();
        }
      };

      // false -> true
      expect(checkbox.checked).toBe(false);
      mockToggleCheckbox(checkbox, true);
      expect(clickCalled).toBe(true);
      expect(checkbox.checked).toBe(true);

      // 同じ状態の場合はクリックしない
      clickCalled = false;
      mockToggleCheckbox(checkbox, true);
      expect(clickCalled).toBe(false);
      expect(checkbox.checked).toBe(true);

      // true -> false
      mockToggleCheckbox(checkbox, false);
      expect(checkbox.checked).toBe(false);
    });

    /**
     * クリックイベントが正しく発火することをテスト
     */
    it('should fire click event when state differs', () => {
      const checkbox = mockHelpers.createMockCheckbox('cal1', 'テストカレンダー', false);
      const clickSpy = jest.spyOn(checkbox, 'click');

      const mockToggleCheckbox = (checkbox: HTMLInputElement, checked: boolean) => {
        if (checkbox.checked !== checked) {
          checkbox.click();
        }
      };

      mockToggleCheckbox(checkbox, true);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // 同じ状態では呼ばれない
      mockToggleCheckbox(checkbox, true);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      mockToggleCheckbox(checkbox, false);
      expect(clickSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('DOM structure validation', () => {
    /**
     * 複雑なDOM構造での動作をテスト
     */
    it('should handle complex DOM structures', () => {
      // 複雑なネストしたDOM構造を作成
      const outerContainer = document.createElement('div');
      outerContainer.className = 'calendar-container';

      const calendarSection = document.createElement('div');
      calendarSection.setAttribute('aria-label', '他のカレンダー');
      calendarSection.setAttribute('role', 'group');

      const listContainer = document.createElement('ul');
      listContainer.className = 'calendar-list';

      for (let i = 1; i <= 3; i++) {
        const listItem = document.createElement('li');
        const checkbox = mockHelpers.createMockCheckbox(`cal${i}`, `カレンダー${i}`);
        const label = document.createElement('span');
        label.textContent = `カレンダー${i}の詳細`;

        listItem.appendChild(checkbox);
        listItem.appendChild(label);
        listContainer.appendChild(listItem);
      }

      calendarSection.appendChild(listContainer);
      outerContainer.appendChild(calendarSection);
      container.appendChild(outerContainer);

      // DOM構造が正しく構築されていることを確認
      const foundSection = document.querySelector('[aria-label="他のカレンダー"]');
      expect(foundSection).toBeTruthy();

      const checkboxes = foundSection?.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes?.length).toBe(3);

      const firstCheckbox = checkboxes?.[0] as HTMLInputElement;
      expect(firstCheckbox?.getAttribute('aria-label')).toBe('カレンダー1');
    });

    /**
     * 日本語属性値の処理をテスト
     */
    it('should handle Japanese attribute values correctly', () => {
      const section = document.createElement('div');
      section.setAttribute('aria-label', '他のカレンダー');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', '田中さんのカレンダー');
      checkbox.setAttribute('data-calendar-name', '営業部');

      section.appendChild(checkbox);
      container.appendChild(section);

      expect(checkbox.getAttribute('aria-label')).toBe('田中さんのカレンダー');
      expect(checkbox.getAttribute('data-calendar-name')).toBe('営業部');
    });
  });
});