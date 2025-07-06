import { CalendarGroup } from './types';
import { StorageService } from './storage';
import { CalendarManager } from './calendar-manager';

export class GroupCreator {
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

      const existingGroups = await StorageService.loadGroups();
      const nameExists = existingGroups.some(group => group.name === groupName);
      
      if (nameExists) {
        this.showMessage('同じ名前のグループが既に存在します。別の名前を選択してください。');
        return;
      }

      const newGroup: CalendarGroup = {
        id: StorageService.generateId(),
        name: groupName,
        calendars: selectedCalendars,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await StorageService.addGroup(newGroup);
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