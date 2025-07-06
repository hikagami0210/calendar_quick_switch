interface CalendarGroup {
  id: string;
  name: string;
  calendars: string[];
  createdAt: number;
  updatedAt: number;
}

interface CalendarCheckbox {
  element: HTMLInputElement;
  label: string;
  checked: boolean;
}

class ContentStorageService {
  private static readonly STORAGE_KEY = 'calendarGroups';
  private static readonly SETTINGS_KEY = 'settings';

  static async saveGroups(groups: CalendarGroup[]): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: groups
      });
    } catch (error) {
      console.error('Failed to save groups:', error);
      throw error;
    }
  }

  static async loadGroups(): Promise<CalendarGroup[]> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('Failed to load groups:', error);
      return [];
    }
  }

  static async saveSettings(settings: { disableOthers: boolean }): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.SETTINGS_KEY]: settings
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  static async loadSettings(): Promise<{ disableOthers: boolean }> {
    try {
      const result = await chrome.storage.local.get(this.SETTINGS_KEY);
      return result[this.SETTINGS_KEY] || { disableOthers: true };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { disableOthers: true };
    }
  }

  static async addGroup(group: CalendarGroup): Promise<void> {
    const groups = await this.loadGroups();
    groups.push(group);
    await this.saveGroups(groups);
  }

  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

class CalendarManager {
  private readonly POSSIBLE_SELECTORS = [
    '[aria-label="他のカレンダー"]',
    '[aria-label="Other calendars"]',
    '[aria-label*="カレンダー"]',
    '[aria-label*="calendar"]',
    '[data-testid*="calendar"]',
    '[role="tree"]',
    '[role="group"]'
  ];
  private readonly CALENDAR_CHECKBOX_SELECTOR = 'input[type="checkbox"]';

  async findOtherCalendarsSection(): Promise<HTMLElement | null> {
    const maxRetries = 10;
    const retryDelay = 500;

    for (let i = 0; i < maxRetries; i++) {
      // 複数のセレクタを試す
      for (const selector of this.POSSIBLE_SELECTORS) {
        const section = document.querySelector(selector) as HTMLElement;
        if (section) {
          // セクション内にチェックボックスがあるかも確認
          const hasCheckboxes = section.querySelectorAll(this.CALENDAR_CHECKBOX_SELECTOR).length > 0;
          if (hasCheckboxes) {
            console.log(`カレンダーセクションを発見: ${selector}`);
            return section;
          }
        }
      }

      // フォールバック: ページ全体からカレンダー用チェックボックスを探す
      const allCheckboxes = document.querySelectorAll(this.CALENDAR_CHECKBOX_SELECTOR);
      if (allCheckboxes.length > 0) {
        // チェックボックスの親要素を探す
        for (const checkbox of Array.from(allCheckboxes)) {
          const container = checkbox.closest('[role="tree"], [role="group"], [aria-label*="calendar"], [aria-label*="カレンダー"]');
          if (container) {
            console.log('フォールバックでカレンダーセクションを発見');
            return container as HTMLElement;
          }
        }
        
        // 最後の手段：すべてのチェックボックスを含む共通の親要素を探す
        const firstCheckbox = allCheckboxes[0] as HTMLElement;
        let parent = firstCheckbox.parentElement;
        while (parent && parent !== document.body) {
          const childCheckboxes = parent.querySelectorAll(this.CALENDAR_CHECKBOX_SELECTOR);
          if (childCheckboxes.length >= allCheckboxes.length * 0.5) { // 半分以上のチェックボックスが含まれている
            console.log('共通親要素をカレンダーセクションとして使用');
            return parent;
          }
          parent = parent.parentElement;
        }
      }

      await this.sleep(retryDelay);
    }

    console.warn('カレンダーセクションが見つかりませんでした。利用可能なチェックボックス:', document.querySelectorAll(this.CALENDAR_CHECKBOX_SELECTOR).length);
    return null;
  }

  async getCalendarCheckboxes(): Promise<CalendarCheckbox[]> {
    const section = await this.findOtherCalendarsSection();
    if (!section) {
      return [];
    }

    const checkboxes = Array.from(section.querySelectorAll(this.CALENDAR_CHECKBOX_SELECTOR)) as HTMLInputElement[];
    const calendarCheckboxes: CalendarCheckbox[] = [];

    for (const checkbox of checkboxes) {
      const label = this.getCalendarLabel(checkbox);
      if (label) {
        calendarCheckboxes.push({
          element: checkbox,
          label: label,
          checked: checkbox.checked
        });
      }
    }

    return calendarCheckboxes;
  }

  private getCalendarLabel(checkbox: HTMLInputElement): string | null {
    // 複数の方法でラベルを取得を試す
    
    // 1. aria-labelledby属性から
    const labelledBy = checkbox.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        const text = labelElement.textContent?.trim();
        if (text) return text;
      }
    }

    // 2. 直接のaria-label属性
    const ariaLabel = checkbox.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // 3. 関連するlabel要素
    const container = checkbox.closest('div, li, span');
    if (container) {
      const label = container.querySelector('label, span, div');
      if (label) {
        const labelAriaLabel = label.getAttribute('aria-label');
        if (labelAriaLabel) return labelAriaLabel;
        
        const text = label.textContent?.trim();
        if (text && text.length > 0 && !text.includes('checkbox')) {
          return text;
        }
      }
    }

    // 4. 近くのテキストノードを探す
    let parent = checkbox.parentElement;
    let attempts = 0;
    while (parent && attempts < 3) {
      const text = parent.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        // チェックボックス以外のテキストがある場合
        const withoutCheckbox = text.replace(/checkbox/gi, '').trim();
        if (withoutCheckbox.length > 0) {
          return withoutCheckbox;
        }
      }
      parent = parent.parentElement;
      attempts++;
    }

    // 5. data属性から
    const dataName = checkbox.getAttribute('data-name') || 
                     checkbox.getAttribute('data-calendar-name') ||
                     checkbox.getAttribute('data-label');
    if (dataName) return dataName;

    return null;
  }

  async applyGroup(group: CalendarGroup, disableOthers: boolean = true): Promise<void> {
    const checkboxes = await this.getCalendarCheckboxes();
    
    if (checkboxes.length === 0) {
      console.warn('チェックボックスが見つかりませんでした');
      return;
    }

    console.log(`グループ "${group.name}" を適用中...`);
    console.log('対象カレンダー:', group.calendars);
    
    for (const checkbox of checkboxes) {
      const shouldBeChecked = group.calendars.includes(checkbox.label);
      
      if (shouldBeChecked && !checkbox.checked) {
        this.toggleCheckbox(checkbox.element, true);
        console.log(`カレンダー "${checkbox.label}" を有効にしました`);
      } else if (!shouldBeChecked && checkbox.checked && disableOthers) {
        this.toggleCheckbox(checkbox.element, false);
        console.log(`カレンダー "${checkbox.label}" を無効にしました`);
      }
    }
  }

  async getCurrentlySelectedCalendars(): Promise<string[]> {
    const checkboxes = await this.getCalendarCheckboxes();
    return checkboxes
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.label);
  }

  private toggleCheckbox(checkbox: HTMLInputElement, checked: boolean): void {
    if (checkbox.checked !== checked) {
      checkbox.click();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForCalendarLoad(): Promise<void> {
    const maxWait = 30000;
    const checkInterval = 1000;
    const startTime = Date.now();

    console.log('カレンダーの読み込みを待機しています...');

    while (Date.now() - startTime < maxWait) {
      // デバッグ情報を出力
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
      console.log(`チェックボックス総数: ${allCheckboxes.length}`);
      
      if (allCheckboxes.length > 0) {
        console.log('見つかったチェックボックス:', Array.from(allCheckboxes).slice(0, 3).map(cb => ({
          id: cb.id,
          name: cb.getAttribute('name'),
          ariaLabel: cb.getAttribute('aria-label'),
          parent: cb.parentElement?.tagName
        })));
      }

      const section = await this.findOtherCalendarsSection();
      if (section) {
        const checkboxes = await this.getCalendarCheckboxes();
        console.log(`カレンダーチェックボックス数: ${checkboxes.length}`);
        
        if (checkboxes.length > 0) {
          console.log('カレンダーが正常に読み込まれました');
          console.log('見つかったカレンダー:', checkboxes.slice(0, 3).map(c => c.label));
          return;
        }
      }

      const elapsed = Date.now() - startTime;
      console.log(`カレンダー読み込み待機中... (${Math.floor(elapsed/1000)}秒経過)`);
      await this.sleep(checkInterval);
    }

    // タイムアウト時の詳細情報
    const finalCheckboxCount = document.querySelectorAll('input[type="checkbox"]').length;
    console.error(`カレンダー読み込みタイムアウト - 総チェックボックス数: ${finalCheckboxCount}`);
    console.error('現在のURL:', window.location.href);
    console.error('ページタイトル:', document.title);

    throw new Error(`カレンダーの読み込みがタイムアウトしました (チェックボックス数: ${finalCheckboxCount})`);
  }
}

class GroupCreator {
  private calendarManager: CalendarManager;

  constructor() {
    this.calendarManager = new CalendarManager();
  }

  async createGroup(): Promise<void> {
    try {
      const selectedCalendars = await this.calendarManager.getCurrentlySelectedCalendars();
      
      if (selectedCalendars.length === 0) {
        this.showMessage('カレンダーが選択されていません。グループを作成するには、少なくとも1つのカレンダーを選択してください。');
        return;
      }

      const groupName = await this.promptForGroupName();
      if (!groupName) {
        return;
      }

      const existingGroups = await ContentStorageService.loadGroups();
      const nameExists = existingGroups.some(group => group.name === groupName);
      
      if (nameExists) {
        this.showMessage('同じ名前のグループが既に存在します。別の名前を選択してください。');
        return;
      }

      const newGroup: CalendarGroup = {
        id: ContentStorageService.generateId(),
        name: groupName,
        calendars: selectedCalendars,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await ContentStorageService.addGroup(newGroup);
      this.showMessage(`グループ "${groupName}" を作成しました。\n含まれるカレンダー: ${selectedCalendars.join(', ')}`);
      
      console.log('新しいグループを作成しました:', newGroup);
    } catch (error) {
      console.error('グループ作成中にエラーが発生しました:', error);
      this.showMessage('グループの作成に失敗しました。');
    }
  }

  private async promptForGroupName(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = this.createModal();
      const input = modal.querySelector('input') as HTMLInputElement;
      const createButton = modal.querySelector('.create-button') as HTMLButtonElement;
      const cancelButton = modal.querySelector('.cancel-button') as HTMLButtonElement;

      const handleCreate = () => {
        const name = input.value.trim();
        if (name) {
          document.body.removeChild(modal);
          resolve(name);
        } else {
          this.showInputError(input, 'グループ名を入力してください');
        }
      };

      const handleCancel = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      createButton.addEventListener('click', handleCreate);
      cancelButton.addEventListener('click', handleCancel);
      
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleCreate();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      });

      document.body.appendChild(modal);
      input.focus();
    });
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'calendar-group-modal';
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <h3>新しいグループを作成</h3>
          <div class="input-group">
            <label for="group-name">グループ名:</label>
            <input type="text" id="group-name" placeholder="例: チームA" maxlength="50" />
            <div class="error-message"></div>
          </div>
          <div class="modal-buttons">
            <button class="cancel-button">キャンセル</button>
            <button class="create-button">作成</button>
          </div>
        </div>
      </div>
    `;

    this.addModalStyles(modal);
    return modal;
  }

  private addModalStyles(modal: HTMLElement): void {
    const style = document.createElement('style');
    style.textContent = `
      .calendar-group-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        font-family: 'Roboto', sans-serif;
      }

      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-content {
        background: white;
        border-radius: 8px;
        padding: 24px;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .modal-content h3 {
        margin: 0 0 20px 0;
        color: #333;
        font-size: 18px;
      }

      .input-group {
        margin-bottom: 20px;
      }

      .input-group label {
        display: block;
        margin-bottom: 6px;
        color: #555;
        font-weight: 500;
      }

      .input-group input {
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
      }

      .input-group input:focus {
        outline: none;
        border-color: #1976d2;
        box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
      }

      .error-message {
        color: #d32f2f;
        font-size: 12px;
        margin-top: 4px;
        min-height: 16px;
      }

      .modal-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }

      .modal-buttons button {
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }

      .cancel-button {
        background: #f5f5f5;
        color: #666;
      }

      .cancel-button:hover {
        background: #e0e0e0;
      }

      .create-button {
        background: #1976d2;
        color: white;
      }

      .create-button:hover {
        background: #1565c0;
      }
    `;

    modal.appendChild(style);
  }

  private showInputError(input: HTMLInputElement, message: string): void {
    const errorElement = input.parentElement?.querySelector('.error-message');
    if (errorElement) {
      errorElement.textContent = message;
      input.style.borderColor = '#d32f2f';
    }
  }

  private showMessage(message: string): void {
    const notification = document.createElement('div');
    notification.className = 'calendar-group-notification';
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
      .calendar-group-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 14px;
        z-index: 10001;
        max-width: 300px;
        word-wrap: break-word;
        white-space: pre-line;
      }
    `;
    
    notification.appendChild(style);
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 4000);
  }
}

class ContentScript {
  private calendarManager: CalendarManager;
  private groupCreator: GroupCreator;

  constructor() {
    this.calendarManager = new CalendarManager();
    this.groupCreator = new GroupCreator();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log('Google カレンダーグループ拡張機能が初期化されました');
    
    try {
      await this.calendarManager.waitForCalendarLoad();
      console.log('カレンダーの読み込みが完了しました');
    } catch (error) {
      console.error('カレンダーの初期化に失敗しました:', error);
    }

    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      this.handleMessage(message, _sender, sendResponse);
      return true;
    });
  }

  private async handleMessage(
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.action) {
        case 'applyGroup':
          await this.handleApplyGroup(message.group, message.settings);
          sendResponse({ success: true });
          break;

        case 'createGroup':
          await this.handleCreateGroup();
          sendResponse({ success: true });
          break;

        case 'getCurrentCalendars':
          const calendars = await this.calendarManager.getCurrentlySelectedCalendars();
          sendResponse({ success: true, calendars });
          break;

        case 'getCalendarList':
          const allCalendars = await this.calendarManager.getCalendarCheckboxes();
          sendResponse({ 
            success: true, 
            calendars: allCalendars.map(c => ({ label: c.label, checked: c.checked }))
          });
          break;

        default:
          console.warn('不明なメッセージアクション:', message.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('メッセージ処理中にエラーが発生しました:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async handleApplyGroup(group: CalendarGroup, settings: { disableOthers: boolean }): Promise<void> {
    console.log(`グループ "${group.name}" を適用しています...`);
    
    await this.calendarManager.applyGroup(group, settings.disableOthers);
    
    console.log(`グループ "${group.name}" の適用が完了しました`);
  }

  private async handleCreateGroup(): Promise<void> {
    console.log('新しいグループの作成を開始します...');
    
    await this.groupCreator.createGroup();
    
    console.log('グループ作成処理が完了しました');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScript();
  });
} else {
  new ContentScript();
}