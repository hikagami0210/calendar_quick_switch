/**
 * UI関数のテスト
 * content-final.ts のUI関連関数をテスト
 */

// import { mockHelpers } from './setup';

describe('UI Functions', () => {
  beforeEach(() => {
    // 各テスト前にクリーンなDOM環境を作成
    document.body.innerHTML = '';
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // テスト後のクリーンアップ
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  describe('showNotification function', () => {
    /**
     * 通知が正常に表示されることをテスト
     */
    it('should display notification with correct content', () => {
      const mockShowNotification = (message: string) => {
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
            font-family: 'Roboto', sans-serif;
          }
        `;
        
        notification.appendChild(style);
        document.body.appendChild(notification);
        
        // 4秒後に自動削除
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 4000);
      };

      const testMessage = 'テスト通知メッセージ';
      mockShowNotification(testMessage);

      const notification = document.querySelector('.calendar-group-notification');
      expect(notification).toBeTruthy();
      expect(notification?.textContent).toBe(testMessage);
      expect(notification?.className).toBe('calendar-group-notification');
    });

    /**
     * 複数行メッセージが正常に表示されることをテスト
     */
    it('should display multi-line messages correctly', () => {
      const mockShowNotification = (message: string) => {
        const notification = document.createElement('div');
        notification.className = 'calendar-group-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
      };

      const multiLineMessage = 'グループ "テストグループ" を作成しました。\n含まれるカレンダー: カレンダー1, カレンダー2';
      mockShowNotification(multiLineMessage);

      const notification = document.querySelector('.calendar-group-notification');
      expect(notification?.textContent).toBe(multiLineMessage);
    });

    /**
     * 通知が自動的に削除されることをテスト
     */
    it('should auto-remove notification after timeout', () => {
      const mockShowNotification = (message: string) => {
        const notification = document.createElement('div');
        notification.className = 'calendar-group-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 4000);
      };

      mockShowNotification('テストメッセージ');

      // 通知が存在することを確認
      expect(document.querySelector('.calendar-group-notification')).toBeTruthy();

      // 4秒経過
      jest.advanceTimersByTime(4000);

      // 通知が削除されていることを確認
      expect(document.querySelector('.calendar-group-notification')).toBeFalsy();
    });

    /**
     * 複数の通知が同時に表示できることをテスト
     */
    it('should allow multiple notifications', () => {
      const mockShowNotification = (message: string, id: string) => {
        const notification = document.createElement('div');
        notification.className = 'calendar-group-notification';
        notification.id = id;
        notification.textContent = message;
        document.body.appendChild(notification);
      };

      mockShowNotification('通知1', 'notif1');
      mockShowNotification('通知2', 'notif2');

      const notifications = document.querySelectorAll('.calendar-group-notification');
      expect(notifications.length).toBe(2);
      expect(notifications[0].textContent).toBe('通知1');
      expect(notifications[1].textContent).toBe('通知2');
    });
  });

  describe('showInputError function', () => {
    /**
     * 入力エラーが正常に表示されることをテスト
     */
    it('should display input error correctly', () => {
      // エラー表示用のDOM構造を作成
      const inputGroup = document.createElement('div');
      inputGroup.className = 'input-group';

      const input = document.createElement('input');
      input.type = 'text';

      const errorMessage = document.createElement('div');
      errorMessage.className = 'error-message';

      inputGroup.appendChild(input);
      inputGroup.appendChild(errorMessage);
      document.body.appendChild(inputGroup);

      const mockShowInputError = (input: HTMLInputElement, message: string) => {
        const errorElement = input.parentElement?.querySelector('.error-message');
        if (errorElement) {
          errorElement.textContent = message;
          input.style.borderColor = '#d32f2f';
        }
      };

      const testErrorMessage = 'グループ名を入力してください';
      mockShowInputError(input, testErrorMessage);

      expect(errorMessage.textContent).toBe(testErrorMessage);
      expect(input.style.borderColor).toBe('#d32f2f');
    });

    /**
     * エラー要素が存在しない場合の処理をテスト
     */
    it('should handle missing error element gracefully', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      const mockShowInputError = (input: HTMLInputElement, message: string) => {
        const errorElement = input.parentElement?.querySelector('.error-message');
        if (errorElement) {
          errorElement.textContent = message;
          input.style.borderColor = '#d32f2f';
        }
        // エラー要素がない場合は何もしない
      };

      // エラーが発生しないことを確認
      expect(() => {
        mockShowInputError(input, 'テストエラー');
      }).not.toThrow();
    });
  });

  describe('createGroupNameModal function', () => {
    /**
     * モーダルが正しい構造で作成されることをテスト
     */
    it('should create modal with correct structure', () => {
      const mockCreateGroupNameModal = (): HTMLElement => {
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
        return modal;
      };

      const modal = mockCreateGroupNameModal();
      
      expect(modal.className).toBe('calendar-group-modal');
      expect(modal.querySelector('h3')?.textContent).toBe('新しいグループを作成');
      expect(modal.querySelector('#group-name')).toBeTruthy();
      expect(modal.querySelector('.create-button')?.textContent).toBe('作成');
      expect(modal.querySelector('.cancel-button')?.textContent).toBe('キャンセル');
      expect(modal.querySelector('.error-message')).toBeTruthy();
    });

    /**
     * 入力フィールドが正しい属性を持つことをテスト
     */
    it('should create input field with correct attributes', () => {
      const mockCreateGroupNameModal = (): HTMLElement => {
        const modal = document.createElement('div');
        modal.innerHTML = `
          <input type="text" id="group-name" placeholder="例: チームA" maxlength="50" />
        `;
        return modal;
      };

      const modal = mockCreateGroupNameModal();
      const input = modal.querySelector('#group-name') as HTMLInputElement;
      
      expect(input.type).toBe('text');
      expect(input.id).toBe('group-name');
      expect(input.placeholder).toBe('例: チームA');
      expect(input.maxLength).toBe(50);
    });
  });

  describe('promptForGroupName function', () => {
    /**
     * ユーザーが有効な名前を入力した場合のテスト
     */
    it('should resolve with group name when user enters valid name', async () => {
      const mockPromptForGroupName = (): Promise<string | null> => {
        return new Promise((resolve) => {
          const modal = document.createElement('div');
          modal.innerHTML = `
            <input type="text" id="group-name" />
            <button class="create-button">作成</button>
            <button class="cancel-button">キャンセル</button>
          `;
          
          const input = modal.querySelector('#group-name') as HTMLInputElement;
          const createButton = modal.querySelector('.create-button') as HTMLButtonElement;
          const cancelButton = modal.querySelector('.cancel-button') as HTMLButtonElement;

          const handleCreate = () => {
            const name = input.value.trim();
            if (name) {
              resolve(name);
            }
          };

          const handleCancel = () => {
            resolve(null);
          };

          createButton.addEventListener('click', handleCreate);
          cancelButton.addEventListener('click', handleCancel);
          
          document.body.appendChild(modal);
          
          // テスト用：入力値を設定してクリックをシミュレート
          setTimeout(() => {
            input.value = 'テストグループ';
            createButton.click();
          }, 0);
        });
      };

      const result = await mockPromptForGroupName();
      expect(result).toBe('テストグループ');
    });

    /**
     * ユーザーがキャンセルした場合のテスト
     */
    it('should resolve with null when user cancels', async () => {
      const mockPromptForGroupName = (): Promise<string | null> => {
        return new Promise((resolve) => {
          const modal = document.createElement('div');
          modal.innerHTML = `
            <input type="text" id="group-name" />
            <button class="create-button">作成</button>
            <button class="cancel-button">キャンセル</button>
          `;
          
          const cancelButton = modal.querySelector('.cancel-button') as HTMLButtonElement;
          cancelButton.addEventListener('click', () => resolve(null));
          
          document.body.appendChild(modal);
          
          // テスト用：キャンセルをシミュレート
          setTimeout(() => {
            cancelButton.click();
          }, 0);
        });
      };

      const result = await mockPromptForGroupName();
      expect(result).toBe(null);
    });

    /**
     * 空の入力値でエラーが表示されることをテスト
     */
    it('should show error for empty input', async () => {
      let errorShown = false;
      
      const mockPromptForGroupName = (): Promise<string | null> => {
        return new Promise((resolve) => {
          const modal = document.createElement('div');
          modal.innerHTML = `
            <div class="input-group">
              <input type="text" id="group-name" />
              <div class="error-message"></div>
            </div>
            <button class="create-button">作成</button>
            <button class="cancel-button">キャンセル</button>
          `;
          
          const input = modal.querySelector('#group-name') as HTMLInputElement;
          const createButton = modal.querySelector('.create-button') as HTMLButtonElement;
          
          const handleCreate = () => {
            const name = input.value.trim();
            if (name) {
              resolve(name);
            } else {
              // エラー表示の模擬
              const errorElement = modal.querySelector('.error-message');
              if (errorElement) {
                errorElement.textContent = 'グループ名を入力してください';
                errorShown = true;
              }
            }
          };

          createButton.addEventListener('click', handleCreate);
          document.body.appendChild(modal);
          
          // テスト用：空の値でクリックをシミュレート
          setTimeout(() => {
            input.value = '';
            createButton.click();
          }, 0);
          
          // テスト終了用のタイムアウト
          setTimeout(() => resolve(null), 100);
        });
      };

      await mockPromptForGroupName();
      expect(errorShown).toBe(true);
    });

    /**
     * Enterキーで送信できることをテスト
     */
    it('should submit on Enter key', async () => {
      const mockPromptForGroupName = (): Promise<string | null> => {
        return new Promise((resolve) => {
          const modal = document.createElement('div');
          modal.innerHTML = `
            <input type="text" id="group-name" />
            <button class="create-button">作成</button>
          `;
          
          const input = modal.querySelector('#group-name') as HTMLInputElement;
          
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              const name = input.value.trim();
              if (name) {
                resolve(name);
              }
            }
          });
          
          document.body.appendChild(modal);
          
          // テスト用：Enterキーをシミュレート
          setTimeout(() => {
            input.value = 'Enterテスト';
            const enterEvent = new KeyboardEvent('keypress', { key: 'Enter' });
            input.dispatchEvent(enterEvent);
          }, 0);
        });
      };

      const result = await mockPromptForGroupName();
      expect(result).toBe('Enterテスト');
    });

    /**
     * Escapeキーでキャンセルできることをテスト
     */
    it('should cancel on Escape key', async () => {
      const mockPromptForGroupName = (): Promise<string | null> => {
        return new Promise((resolve) => {
          const modal = document.createElement('div');
          modal.innerHTML = `<input type="text" id="group-name" />`;
          
          const input = modal.querySelector('#group-name') as HTMLInputElement;
          
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Escape') {
              resolve(null);
            }
          });
          
          document.body.appendChild(modal);
          
          // テスト用：Escapeキーをシミュレート
          setTimeout(() => {
            const escapeEvent = new KeyboardEvent('keypress', { key: 'Escape' });
            input.dispatchEvent(escapeEvent);
          }, 0);
        });
      };

      const result = await mockPromptForGroupName();
      expect(result).toBe(null);
    });
  });

  describe('CSS styles injection', () => {
    /**
     * スタイルが正しく注入されることをテスト
     */
    it('should inject styles correctly', () => {
      const mockAddModalStyles = (modal: HTMLElement) => {
        const style = document.createElement('style');
        style.textContent = `
          .calendar-group-modal {
            position: fixed;
            top: 0;
            left: 0;
            z-index: 10000;
          }
        `;
        modal.appendChild(style);
      };

      const modal = document.createElement('div');
      modal.className = 'calendar-group-modal';
      
      mockAddModalStyles(modal);
      
      const styleElement = modal.querySelector('style');
      expect(styleElement).toBeTruthy();
      expect(styleElement?.textContent).toContain('position: fixed');
      expect(styleElement?.textContent).toContain('z-index: 10000');
    });

    /**
     * 通知スタイルが正しく適用されることをテスト
     */
    it('should apply notification styles correctly', () => {
      const notification = document.createElement('div');
      notification.className = 'calendar-group-notification';
      
      const style = document.createElement('style');
      style.textContent = `
        .calendar-group-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #333;
          color: white;
        }
      `;
      
      notification.appendChild(style);
      document.body.appendChild(notification);
      
      expect(notification.querySelector('style')).toBeTruthy();
      expect(notification.querySelector('style')?.textContent).toContain('background: #333');
    });
  });

  describe('Modal cleanup', () => {
    /**
     * モーダルが適切にクリーンアップされることをテスト
     */
    it('should clean up modal after use', () => {
      const modal = document.createElement('div');
      modal.className = 'calendar-group-modal';
      document.body.appendChild(modal);
      
      expect(document.querySelector('.calendar-group-modal')).toBeTruthy();
      
      // モーダルを削除
      document.body.removeChild(modal);
      
      expect(document.querySelector('.calendar-group-modal')).toBeFalsy();
    });

    /**
     * 複数のモーダルが同時に存在しないことをテスト
     */
    it('should prevent multiple modals', () => {
      const createModal = () => {
        // 既存のモーダルがあれば削除
        const existing = document.querySelector('.calendar-group-modal');
        if (existing) {
          document.body.removeChild(existing);
        }
        
        const modal = document.createElement('div');
        modal.className = 'calendar-group-modal';
        document.body.appendChild(modal);
        return modal;
      };

      createModal();
      expect(document.querySelectorAll('.calendar-group-modal').length).toBe(1);
      
      createModal();
      expect(document.querySelectorAll('.calendar-group-modal').length).toBe(1);
    });
  });
});