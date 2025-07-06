/**
 * Google カレンダーグループ拡張機能 - バックグラウンドスクリプト
 * カレンダーグループの管理とコンテキストメニューの制御を行います
 */

import {
  CalendarGroup,
  Settings,
  STORAGE_KEYS,
  MENU_IDS,
  DEFAULT_SETTINGS,
  generateId,
} from "./shared";

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
 * 設定を保存します
 * @param {Settings} settings - 保存する設定
 * @returns {Promise<void>}
 */
async function saveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: settings,
    });
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
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

// ===== コンテキストメニュー管理 =====

/**
 * コンテキストメニューを更新します
 * 既存のメニューを削除し、現在のグループに基づいて再構築します
 * @returns {Promise<void>}
 */
async function updateContextMenus(): Promise<void> {
  // 既存のメニューをすべて削除
  chrome.contextMenus.removeAll(async () => {
    const groups = await loadGroups();

    // グループが存在する場合は各グループのメニューを作成
    if (groups.length > 0) {
      groups.forEach((group) => {
        chrome.contextMenus.create({
          id: MENU_IDS.PREFIX + group.id,
          title: `グループ: ${group.name}`,
          contexts: ["page"],
          documentUrlPatterns: ["https://calendar.google.com/*"],
        });
      });

      // セパレーターを追加
      chrome.contextMenus.create({
        id: MENU_IDS.SEPARATOR,
        type: "separator",
        contexts: ["page"],
        documentUrlPatterns: ["https://calendar.google.com/*"],
      });
    }

    // 「グループを作成」メニューを追加
    chrome.contextMenus.create({
      id: MENU_IDS.CREATE,
      title: "グループを作成",
      contexts: ["page"],
      documentUrlPatterns: ["https://calendar.google.com/*"],
    });
  });
}

// ===== メッセージ送信 =====

/**
 * コンテンツスクリプトにグループ作成メッセージを送信します
 * @param {number} tabId - 対象タブのID
 * @returns {Promise<void>}
 */
async function sendCreateGroupMessage(tabId: number): Promise<void> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "createGroup",
    });

    if (response && response.success) {
      console.log("Group creation initiated successfully");
    }
  } catch (error) {
    console.error("Failed to initiate group creation:", error);
  }
}

/**
 * コンテンツスクリプトにグループ適用メッセージを送信します
 * @param {number} tabId - 対象タブのID
 * @param {string} groupId - 適用するグループのID
 * @returns {Promise<void>}
 */
async function sendApplyGroupMessage(
  tabId: number,
  groupId: string
): Promise<void> {
  try {
    const groups = await loadGroups();
    const selectedGroup = groups.find((g) => g.id === groupId);

    if (!selectedGroup) {
      console.error("Group not found:", groupId);
      return;
    }

    const settings = await loadSettings();

    const response = await chrome.tabs.sendMessage(tabId, {
      action: "applyGroup",
      group: selectedGroup,
      settings: settings,
    });

    if (response && response.success) {
      console.log("Group applied successfully:", selectedGroup.name);
    }
  } catch (error) {
    console.error("Failed to apply group:", error);
  }
}

// ===== イベントハンドラー =====

/**
 * コンテキストメニューがクリックされた時の処理
 * @param {chrome.contextMenus.OnClickData} info - クリック情報
 * @param {chrome.tabs.Tab} [tab] - 対象タブ
 * @returns {Promise<void>}
 */
async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (!tab?.id) return;

  const menuItemId = info.menuItemId as string;

  try {
    if (menuItemId === MENU_IDS.CREATE) {
      // グループ作成メニューがクリックされた場合
      await sendCreateGroupMessage(tab.id);
    } else if (menuItemId.startsWith(MENU_IDS.PREFIX)) {
      // 既存グループメニューがクリックされた場合
      const groupId = menuItemId.replace(MENU_IDS.PREFIX, "");
      await sendApplyGroupMessage(tab.id, groupId);
    }
  } catch (error) {
    console.error("Error handling context menu click:", error);
  }
}

/**
 * ストレージが変更された時の処理
 * グループが変更された場合はコンテキストメニューを更新します
 * @param {object} changes - 変更内容
 * @param {string} namespace - ストレージの名前空間
 * @returns {Promise<void>}
 */
async function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  namespace: string
): Promise<void> {
  if (namespace === "local" && changes[STORAGE_KEYS.GROUPS]) {
    console.log("Groups changed, updating context menus");
    await updateContextMenus();
  }
}

// ===== 初期化 =====

/**
 * バックグラウンドスクリプトを初期化します
 * イベントリスナーの設定とコンテキストメニューの初期化を行います
 * @returns {Promise<void>}
 */
async function initializeBackground(): Promise<void> {
  console.log("Initializing background script...");

  // イベントリスナーを設定
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
  chrome.storage.onChanged.addListener(handleStorageChange);

  // コンテキストメニューを初期化
  await updateContextMenus();

  console.log("Background script initialized successfully");
}

// バックグラウンドスクリプトを初期化
initializeBackground();
