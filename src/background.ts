/**
 * Google カレンダーグループ拡張機能 - バックグラウンドスクリプト
 * カレンダーグループの管理とコンテキストメニューの制御を行います
 */

// ===== 型定義 =====

interface CalendarGroup {
  id: string;
  name: string;
  calendars: string[];
  createdAt: number;
  updatedAt: number;
}

interface Settings {
  disableOthers: boolean;
}

// ===== 定数 =====

const BG_STORAGE_KEYS = {
  GROUPS: "calendarGroups",
  SETTINGS: "settings",
} as const;

const BG_MENU_IDS = {
  PREFIX: "calendar-group-",
  CREATE: "create-group",
  UNCHECK_ALL: "uncheck-all",
  SEPARATOR: "separator",
  SETTINGS: "open-settings",
} as const;

const BG_DEFAULT_SETTINGS: Settings = {
  disableOthers: true,
};

// ===== ストレージ関数 =====

/**
 * カレンダーグループを保存します
 * @param {CalendarGroup[]} groups - 保存するグループの配列
 * @returns {Promise<void>}
 */
async function bgSaveGroups(groups: CalendarGroup[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [BG_STORAGE_KEYS.GROUPS]: groups,
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
async function bgLoadGroups(): Promise<CalendarGroup[]> {
  try {
    const result = await chrome.storage.local.get(BG_STORAGE_KEYS.GROUPS);
    return result[BG_STORAGE_KEYS.GROUPS] || [];
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
async function bgSaveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({
      [BG_STORAGE_KEYS.SETTINGS]: settings,
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
async function bgLoadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(BG_STORAGE_KEYS.SETTINGS);
    return { ...BG_DEFAULT_SETTINGS, ...result[BG_STORAGE_KEYS.SETTINGS] };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return BG_DEFAULT_SETTINGS;
  }
}

/**
 * 新しいグループを追加します
 * @param {CalendarGroup} group - 追加するグループ
 * @returns {Promise<void>}
 */
async function bgAddGroup(group: CalendarGroup): Promise<void> {
  const groups = await bgLoadGroups();
  groups.push(group);
  await bgSaveGroups(groups);
}

// ===== コンテキストメニュー管理 =====

/**
 * コンテキストメニューを更新します
 * 既存のメニューを削除し、現在のグループに基づいて再構築します
 * @returns {Promise<void>}
 */
async function bgUpdateContextMenus(): Promise<void> {
  // 既存のメニューをすべて削除
  chrome.contextMenus.removeAll(async () => {
    const groups = await bgLoadGroups();

    // グループが存在する場合は各グループのメニューを作成
    if (groups.length > 0) {
      groups.forEach((group) => {
        chrome.contextMenus.create({
          id: BG_MENU_IDS.PREFIX + group.id,
          title: `グループ: ${group.name}`,
          contexts: ["page"],
          documentUrlPatterns: ["https://calendar.google.com/*"],
        });
      });

      // セパレーターを追加
      chrome.contextMenus.create({
        id: BG_MENU_IDS.SEPARATOR,
        type: "separator",
        contexts: ["page"],
        documentUrlPatterns: ["https://calendar.google.com/*"],
      });
    }

    // 「グループを作成」メニューを追加
    chrome.contextMenus.create({
      id: BG_MENU_IDS.CREATE,
      title: "グループを作成",
      contexts: ["page"],
      documentUrlPatterns: ["https://calendar.google.com/*"],
    });

    // 「全てチェックを外す」メニューを追加
    chrome.contextMenus.create({
      id: BG_MENU_IDS.UNCHECK_ALL,
      title: "全てチェックを外す",
      contexts: ["page"],
      documentUrlPatterns: ["https://calendar.google.com/*"],
    });

    // 「設定」メニューを追加
    chrome.contextMenus.create({
      id: BG_MENU_IDS.SETTINGS,
      title: "設定",
      contexts: ["page"],
      documentUrlPatterns: ["https://calendar.google.com/*"],
    });
  });
}

// ===== ページ操作 =====

/**
 * 設定ページを新しいタブで開きます
 * @returns {Promise<void>}
 */
async function bgOpenSettingsPage(): Promise<void> {
  try {
    const settingsUrl = chrome.runtime.getURL("settings.html");
    await chrome.tabs.create({
      url: settingsUrl,
    });
    console.log("Settings page opened successfully");
  } catch (error) {
    console.error("Failed to open settings page:", error);
  }
}

// ===== メッセージ送信 =====

/**
 * コンテンツスクリプトにグループ作成メッセージを送信します
 * @param {number} tabId - 対象タブのID
 * @returns {Promise<void>}
 */
async function bgSendCreateGroupMessage(tabId: number): Promise<void> {
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
 * コンテンツスクリプトに全てチェックを外すメッセージを送信します
 * @param {number} tabId - 対象タブのID
 * @returns {Promise<void>}
 */
async function bgSendUncheckAllMessage(tabId: number): Promise<void> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "uncheckAll",
    });

    if (response && response.success) {
      console.log("Uncheck all initiated successfully");
    }
  } catch (error) {
    console.error("Failed to initiate uncheck all:", error);
  }
}

/**
 * コンテンツスクリプトにグループ適用メッセージを送信します
 * @param {number} tabId - 対象タブのID
 * @param {string} groupId - 適用するグループのID
 * @returns {Promise<void>}
 */
async function bgSendApplyGroupMessage(
  tabId: number,
  groupId: string
): Promise<void> {
  try {
    const groups = await bgLoadGroups();
    const selectedGroup = groups.find((g) => g.id === groupId);

    if (!selectedGroup) {
      console.error("Group not found:", groupId);
      return;
    }

    const settings = await bgLoadSettings();

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
async function bgHandleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (!tab?.id) return;

  const menuItemId = info.menuItemId as string;

  try {
    if (menuItemId === BG_MENU_IDS.CREATE) {
      // グループ作成メニューがクリックされた場合
      await bgSendCreateGroupMessage(tab.id);
    } else if (menuItemId === BG_MENU_IDS.UNCHECK_ALL) {
      // 全てチェックを外すメニューがクリックされた場合
      await bgSendUncheckAllMessage(tab.id);
    } else if (menuItemId === BG_MENU_IDS.SETTINGS) {
      // 設定メニューがクリックされた場合
      await bgOpenSettingsPage();
    } else if (menuItemId.startsWith(BG_MENU_IDS.PREFIX)) {
      // 既存グループメニューがクリックされた場合
      const groupId = menuItemId.replace(BG_MENU_IDS.PREFIX, "");
      await bgSendApplyGroupMessage(tab.id, groupId);
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
async function bgHandleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  namespace: string
): Promise<void> {
  if (namespace === "local" && changes[BG_STORAGE_KEYS.GROUPS]) {
    console.log("Groups changed, updating context menus");
    await bgUpdateContextMenus();
  }
}

// ===== 初期化 =====

/**
 * バックグラウンドスクリプトを初期化します
 * イベントリスナーの設定とコンテキストメニューの初期化を行います
 * @returns {Promise<void>}
 */
async function bgInitialize(): Promise<void> {
  console.log("Initializing background script...");

  // イベントリスナーを設定
  chrome.contextMenus.onClicked.addListener(bgHandleContextMenuClick);
  chrome.storage.onChanged.addListener(bgHandleStorageChange);

  // コンテキストメニューを初期化
  await bgUpdateContextMenus();

  console.log("Background script initialized successfully");
}

// バックグラウンドスクリプトを初期化
bgInitialize();
