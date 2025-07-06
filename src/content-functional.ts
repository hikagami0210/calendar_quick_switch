/**
 * Google カレンダーグループ拡張機能 - コンテンツスクリプト
 * Google Calendarページでのカレンダー操作とグループ管理を行います
 */

import {
  CalendarGroup,
  CalendarCheckbox,
  Settings,
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  generateId,
  sleep,
} from "./shared";

// カレンダーセクションを探すためのセレクタ（優先度順）
const CALENDAR_SELECTORS = [
  '[aria-label="他のカレンダー"]',
  '[aria-label="Other calendars"]',
  '[aria-label*="カレンダー"]',
  '[aria-label*="calendar"]',
  '[data-testid*="calendar"]',
  '[role="tree"]',
  '[role="group"]',
] as const;

const CHECKBOX_SELECTOR = 'input[type="checkbox"]';

// ===== ストレージ関数 =====

/**
 * カレンダーグループを保存します
 * @param {CalendarGroup[]} groups - 保存するグループの配列
 * @returns {Promise<void>}
 */
async function saveGroups(groups: CalendarGroup[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.GROUPS]: groups,
    });
  } catch (error) {
    console.error("Failed to save groups:", error);
    throw error;
  }
}

/**
 * カレンダーグループを読み込みます
 * @returns {Promise<CalendarGroup[]>} 保存されているグループの配列
 */
async function loadGroups(): Promise<CalendarGroup[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.GROUPS);
    return result[STORAGE_KEYS.GROUPS] || [];
  } catch (error) {
    console.error("Failed to load groups:", error);
    return [];
  }
}

/**
 * 設定を読み込みます
 * @returns {Promise<Settings>} 保存されている設定（デフォルト値を含む）
 */
async function loadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 新しいグループを追加します
 * @param {CalendarGroup} group - 追加するグループ
 * @returns {Promise<void>}
 */
async function addGroup(group: CalendarGroup): Promise<void> {
  const groups = await loadGroups();
  groups.push(group);
  await saveGroups(groups);
}

// ===== DOM操作関数 =====

/**
 * カレンダーセクションを探します
 * 複数のセレクタパターンを試行し、チェックボックスを含むセクションを返します
 * @returns {Promise<HTMLElement | null>} 見つかったカレンダーセクション、または null
 */
async function findCalendarSection(): Promise<HTMLElement | null> {
  const maxRetries = 10;
  const retryDelay = 500;

  for (let i = 0; i < maxRetries; i++) {
    // 各セレクタを試行
    for (const selector of CALENDAR_SELECTORS) {
      const section = document.querySelector(selector) as HTMLElement;
      if (section) {
        // セクション内にチェックボックスがあるかチェック
        const hasCheckboxes =
          section.querySelectorAll(CHECKBOX_SELECTOR).length > 0;
        if (hasCheckboxes) {
          console.log(`カレンダーセクションを発見: ${selector}`);
          return section;
        }
      }
    }

    // フォールバック: ページ全体からカレンダー用チェックボックスを探す
    const allCheckboxes = document.querySelectorAll(CHECKBOX_SELECTOR);
    if (allCheckboxes.length > 0) {
      // チェックボックスの親要素を探す
      for (const checkbox of Array.from(allCheckboxes)) {
        const container = checkbox.closest(
          '[role="tree"], [role="group"], [aria-label*="calendar"], [aria-label*="カレンダー"]'
        );
        if (container) {
          console.log("フォールバックでカレンダーセクションを発見");
          return container as HTMLElement;
        }
      }

      // 最後の手段：すべてのチェックボックスを含む共通の親要素を探す
      const firstCheckbox = allCheckboxes[0] as HTMLElement;
      let parent = firstCheckbox.parentElement;
      while (parent && parent !== document.body) {
        const childCheckboxes = parent.querySelectorAll(CHECKBOX_SELECTOR);
        if (childCheckboxes.length >= allCheckboxes.length * 0.5) {
          console.log("共通親要素をカレンダーセクションとして使用");
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    await sleep(retryDelay);
  }

  console.warn(
    "カレンダーセクションが見つかりませんでした。利用可能なチェックボックス:",
    document.querySelectorAll(CHECKBOX_SELECTOR).length
  );
  return null;
}

/**
 * チェックボックス要素からカレンダー名を取得します
 * 複数の方法を試行してラベルテキストを取得します
 * @param {HTMLInputElement} checkbox - 対象のチェックボックス要素
 * @returns {string | null} カレンダー名、または null
 */
function getCalendarLabel(checkbox: HTMLInputElement): string | null {
  // 1. aria-labelledby属性から取得
  const labelledBy = checkbox.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) {
      const text = labelElement.textContent?.trim();
      if (text) return text;
    }
  }

  // 2. 直接のaria-label属性
  const ariaLabel = checkbox.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // 3. 関連するlabel要素
  const container = checkbox.closest("div, li, span");
  if (container) {
    const label = container.querySelector("label, span, div");
    if (label) {
      const labelAriaLabel = label.getAttribute("aria-label");
      if (labelAriaLabel) return labelAriaLabel;

      const text = label.textContent?.trim();
      if (text && text.length > 0 && !text.includes("checkbox")) {
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
      const withoutCheckbox = text.replace(/checkbox/gi, "").trim();
      if (withoutCheckbox.length > 0) {
        return withoutCheckbox;
      }
    }
    parent = parent.parentElement;
    attempts++;
  }

  // 5. data属性から取得
  const dataName =
    checkbox.getAttribute("data-name") ||
    checkbox.getAttribute("data-calendar-name") ||
    checkbox.getAttribute("data-label");
  if (dataName) return dataName;

  return null;
}

/**
 * カレンダーのチェックボックス一覧を取得します
 * @returns {Promise<CalendarCheckbox[]>} カレンダーチェックボックスの配列
 */
async function getCalendarCheckboxes(): Promise<CalendarCheckbox[]> {
  const section = await findCalendarSection();
  if (!section) {
    return [];
  }

  const checkboxes = Array.from(
    section.querySelectorAll(CHECKBOX_SELECTOR)
  ) as HTMLInputElement[];
  const calendarCheckboxes: CalendarCheckbox[] = [];

  for (const checkbox of checkboxes) {
    const label = getCalendarLabel(checkbox);
    if (label) {
      calendarCheckboxes.push({
        element: checkbox,
        label: label,
        checked: checkbox.checked,
      });
    }
  }

  return calendarCheckboxes;
}

/**
 * チェックボックスの状態を切り替えます
 * @param {HTMLInputElement} checkbox - 対象のチェックボックス
 * @param {boolean} checked - 設定する状態
 */
function toggleCheckbox(checkbox: HTMLInputElement, checked: boolean): void {
  if (checkbox.checked !== checked) {
    checkbox.click();
  }
}

/**
 * カレンダーの読み込み完了を待機します
 * @returns {Promise<void>}
 * @throws {Error} タイムアウト時にエラーを投げます
 */
async function waitForCalendarLoad(): Promise<void> {
  const maxWait = 30000; // 30秒
  const checkInterval = 1000; // 1秒間隔
  const startTime = Date.now();

  console.log("カレンダーの読み込みを待機しています...");

  while (Date.now() - startTime < maxWait) {
    // デバッグ情報を出力
    const allCheckboxes = document.querySelectorAll(CHECKBOX_SELECTOR);
    console.log(`チェックボックス総数: ${allCheckboxes.length}`);

    if (allCheckboxes.length > 0) {
      console.log(
        "見つかったチェックボックス:",
        Array.from(allCheckboxes)
          .slice(0, 3)
          .map((cb) => ({
            id: (cb as HTMLInputElement).id,
            name: cb.getAttribute("name"),
            ariaLabel: cb.getAttribute("aria-label"),
            parent: cb.parentElement?.tagName,
          }))
      );
    }

    const section = await findCalendarSection();
    if (section) {
      const checkboxes = await getCalendarCheckboxes();
      console.log(`カレンダーチェックボックス数: ${checkboxes.length}`);

      if (checkboxes.length > 0) {
        console.log("カレンダーが正常に読み込まれました");
        console.log(
          "見つかったカレンダー:",
          checkboxes.slice(0, 3).map((c) => c.label)
        );
        return;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `カレンダー読み込み待機中... (${Math.floor(elapsed / 1000)}秒経過)`
    );
    await sleep(checkInterval);
  }

  // タイムアウト時の詳細情報
  const finalCheckboxCount =
    document.querySelectorAll(CHECKBOX_SELECTOR).length;
  console.error(
    `カレンダー読み込みタイムアウト - 総チェックボックス数: ${finalCheckboxCount}`
  );
  console.error("現在のURL:", window.location.href);
  console.error("ページタイトル:", document.title);

  throw new Error(
    `カレンダーの読み込みがタイムアウトしました (チェックボックス数: ${finalCheckboxCount})`
  );
}

// ===== カレンダー操作関数 =====

/**
 * 指定されたグループをカレンダーに適用します
 * @param {CalendarGroup} group - 適用するグループ
 * @param {boolean} [disableOthers=true] - グループ外のカレンダーを無効にするかどうか
 * @returns {Promise<void>}
 */
async function applyCalendarGroup(
  group: CalendarGroup,
  disableOthers: boolean = true
): Promise<void> {
  const checkboxes = await getCalendarCheckboxes();

  if (checkboxes.length === 0) {
    console.warn("チェックボックスが見つかりませんでした");
    return;
  }

  console.log(`グループ "${group.name}" を適用中...`);
  console.log("対象カレンダー:", group.calendars);

  for (const checkbox of checkboxes) {
    const shouldBeChecked = group.calendars.includes(checkbox.label);

    if (shouldBeChecked && !checkbox.checked) {
      toggleCheckbox(checkbox.element, true);
      console.log(`カレンダー "${checkbox.label}" を有効にしました`);
    } else if (!shouldBeChecked && checkbox.checked && disableOthers) {
      toggleCheckbox(checkbox.element, false);
      console.log(`カレンダー "${checkbox.label}" を無効にしました`);
    }
  }
}

/**
 * 現在選択されているカレンダー名の配列を取得します
 * @returns {Promise<string[]>} 選択中のカレンダー名の配列
 */
async function getCurrentlySelectedCalendars(): Promise<string[]> {
  const checkboxes = await getCalendarCheckboxes();
  return checkboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.label);
}

// ===== UI関数 =====

/**
 * 通知メッセージを表示します
 * @param {string} message - 表示するメッセージ
 */
function showNotification(message: string): void {
  const notification = document.createElement("div");
  notification.className = "calendar-group-notification";
  notification.textContent = message;

  const style = document.createElement("style");
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
}

/**
 * 入力エラーを表示します
 * @param {HTMLInputElement} input - エラーを表示する入力要素
 * @param {string} message - エラーメッセージ
 */
function showInputError(input: HTMLInputElement, message: string): void {
  const errorElement = input.parentElement?.querySelector(".error-message");
  if (errorElement) {
    errorElement.textContent = message;
    input.style.borderColor = "#d32f2f";
  }
}

/**
 * グループ名入力ダイアログを表示します
 * @returns {Promise<string | null>} 入力されたグループ名、またはキャンセル時はnull
 */
function promptForGroupName(): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = createGroupNameModal();
    const input = modal.querySelector("input") as HTMLInputElement;
    const createButton = modal.querySelector(
      ".create-button"
    ) as HTMLButtonElement;
    const cancelButton = modal.querySelector(
      ".cancel-button"
    ) as HTMLButtonElement;

    const handleCreate = () => {
      const name = input.value.trim();
      if (name) {
        document.body.removeChild(modal);
        resolve(name);
      } else {
        showInputError(input, "グループ名を入力してください");
      }
    };

    const handleCancel = () => {
      document.body.removeChild(modal);
      resolve(null);
    };

    // イベントリスナーを設定
    createButton.addEventListener("click", handleCreate);
    cancelButton.addEventListener("click", handleCancel);

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleCreate();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    });

    document.body.appendChild(modal);
    input.focus();
  });
}

/**
 * グループ名入力用のモーダルダイアログを作成します
 * @returns {HTMLElement} 作成されたモーダル要素
 */
function createGroupNameModal(): HTMLElement {
  const modal = document.createElement("div");
  modal.className = "calendar-group-modal";
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

  addModalStyles(modal);
  return modal;
}

/**
 * モーダルダイアログにスタイルを追加します
 * @param {HTMLElement} modal - スタイルを追加するモーダル要素
 */
function addModalStyles(modal: HTMLElement): void {
  const style = document.createElement("style");
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

// ===== グループ管理関数 =====

/**
 * 新しいカレンダーグループを作成します
 * 現在選択されているカレンダーから新しいグループを作成します
 * @returns {Promise<void>}
 */
async function createCalendarGroup(): Promise<void> {
  try {
    const selectedCalendars = await getCurrentlySelectedCalendars();

    if (selectedCalendars.length === 0) {
      showNotification(
        "カレンダーが選択されていません。グループを作成するには、少なくとも1つのカレンダーを選択してください。"
      );
      return;
    }

    const groupName = await promptForGroupName();
    if (!groupName) {
      return; // ユーザーがキャンセルした場合
    }

    // 既存グループ名との重複チェック
    const existingGroups = await loadGroups();
    const nameExists = existingGroups.some((group) => group.name === groupName);

    if (nameExists) {
      showNotification(
        "同じ名前のグループが既に存在します。別の名前を選択してください。"
      );
      return;
    }

    // 新しいグループを作成
    const newGroup: CalendarGroup = {
      id: generateId(),
      name: groupName,
      calendars: selectedCalendars,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await addGroup(newGroup);
    showNotification(
      `グループ "${groupName}" を作成しました。\n含まれるカレンダー: ${selectedCalendars.join(
        ", "
      )}`
    );

    console.log("新しいグループを作成しました:", newGroup);
  } catch (error) {
    console.error("グループ作成中にエラーが発生しました:", error);
    showNotification("グループの作成に失敗しました。");
  }
}

// ===== メッセージハンドラー =====

/**
 * バックグラウンドスクリプトからのメッセージを処理します
 * @param {any} message - 受信したメッセージ
 * @param {chrome.runtime.MessageSender} _sender - 送信者情報（未使用）
 * @param {Function} sendResponse - レスポンス送信関数
 * @returns {Promise<void>}
 */
async function handleMessage(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  try {
    switch (message.action) {
      case "applyGroup":
        // グループを適用
        await applyCalendarGroup(message.group, message.settings.disableOthers);
        sendResponse({ success: true });
        break;

      case "createGroup":
        // グループを作成
        await createCalendarGroup();
        sendResponse({ success: true });
        break;

      case "getCurrentCalendars":
        // 現在選択中のカレンダーを取得
        const calendars = await getCurrentlySelectedCalendars();
        sendResponse({ success: true, calendars });
        break;

      case "getCalendarList":
        // 全カレンダーの一覧を取得
        const allCalendars = await getCalendarCheckboxes();
        sendResponse({
          success: true,
          calendars: allCalendars.map((c) => ({
            label: c.label,
            checked: c.checked,
          })),
        });
        break;

      default:
        console.warn("不明なメッセージアクション:", message.action);
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    console.error("メッセージ処理中にエラーが発生しました:", error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// ===== 初期化 =====

/**
 * コンテンツスクリプトを初期化します
 * カレンダーの読み込み待機とメッセージリスナーの設定を行います
 * @returns {Promise<void>}
 */
async function initializeContentScript(): Promise<void> {
  console.log("Google カレンダーグループ拡張機能が初期化されました");

  try {
    // カレンダーの読み込み完了を待機
    await waitForCalendarLoad();
    console.log("カレンダーの読み込みが完了しました");
  } catch (error) {
    console.error("カレンダーの初期化に失敗しました:", error);
  }

  // メッセージリスナーを設定
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // 非同期レスポンスを送信することを示す
  });
}

// DOM読み込み完了後に初期化を実行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeContentScript);
} else {
  initializeContentScript();
}
