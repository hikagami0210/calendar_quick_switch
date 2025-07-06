/**
 * Google カレンダーグループ拡張機能 - ポップアップスクリプト
 * ポップアップUIの制御とグループ情報の表示を行います
 */

// ===== 定数 =====

const STORAGE_KEYS = {
  GROUPS: 'calendarGroups',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  disableOthers: true
};

// ===== ストレージ関数 =====

/**
 * カレンダーグループを読み込みます
 * @returns {Promise<Array>} 保存されているグループの配列
 */
async function loadGroups() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.GROUPS);
    return result[STORAGE_KEYS.GROUPS] || [];
  } catch (error) {
    console.error('Failed to load groups:', error);
    return [];
  }
}

/**
 * 設定を読み込みます
 * @returns {Promise<Object>} 保存されている設定（デフォルト値を含む）
 */
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// ===== UI更新関数 =====

/**
 * グループプレビューを更新します
 * @param {Array} groups - 表示するグループの配列
 */
function updateGroupsPreview(groups) {
  const previewContainer = document.getElementById('groupsPreview');
  
  if (!groups || groups.length === 0) {
    previewContainer.innerHTML = '<div class="no-groups">保存されたグループがありません</div>';
    return;
  }

  previewContainer.innerHTML = '';
  
  groups.slice(0, 5).forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    
    const groupName = document.createElement('div');
    groupName.className = 'group-name';
    groupName.textContent = group.name;
    
    const groupCalendars = document.createElement('div');
    groupCalendars.className = 'group-calendars';
    
    if (group.calendars && group.calendars.length > 0) {
      const calendarText = group.calendars.length > 3 
        ? `${group.calendars.slice(0, 3).join(', ')} 他${group.calendars.length - 3}件`
        : group.calendars.join(', ');
      groupCalendars.textContent = calendarText;
    } else {
      groupCalendars.textContent = 'カレンダーなし';
    }
    
    groupItem.appendChild(groupName);
    groupItem.appendChild(groupCalendars);
    previewContainer.appendChild(groupItem);
  });
  
  // 5件を超える場合は件数を表示
  if (groups.length > 5) {
    const moreInfo = document.createElement('div');
    moreInfo.className = 'no-groups';
    moreInfo.style.padding = '8px';
    moreInfo.textContent = `他 ${groups.length - 5} 件のグループがあります`;
    previewContainer.appendChild(moreInfo);
  }
}

/**
 * ステータスメッセージを更新します
 * @param {string} message - 表示するメッセージ
 * @param {boolean} isError - エラーメッセージかどうか
 */
function updateStatus(message, isError = false) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.style.color = isError ? '#d32f2f' : '#888';
}

// ===== イベントハンドラー =====

/**
 * 設定ページを開きます
 */
function openSettings() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('settings.html')
  });
  window.close();
}

/**
 * ポップアップの初期化を行います
 */
async function initializePopup() {
  try {
    updateStatus('読み込み中...');
    
    // グループデータを読み込み
    const groups = await loadGroups();
    const settings = await loadSettings();
    
    // UIを更新
    updateGroupsPreview(groups);
    
    // ステータスを更新
    if (groups.length === 0) {
      updateStatus('Google Calendarでグループを作成してください');
    } else {
      updateStatus(`${groups.length} 件のグループが保存されています`);
    }
    
    console.log('Popup initialized successfully');
    console.log('Groups:', groups.length);
    console.log('Settings:', settings);
    
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    updateStatus('データの読み込みに失敗しました', true);
  }
}

/**
 * ストレージの変更を監視します
 */
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[STORAGE_KEYS.GROUPS]) {
      console.log('Groups changed, updating preview');
      const newGroups = changes[STORAGE_KEYS.GROUPS].newValue || [];
      updateGroupsPreview(newGroups);
      
      if (newGroups.length === 0) {
        updateStatus('Google Calendarでグループを作成してください');
      } else {
        updateStatus(`${newGroups.length} 件のグループが保存されています`);
      }
    }
  });
}

// ===== 初期化 =====

/**
 * DOMが読み込まれた後に実行される初期化処理
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');
  
  // イベントリスナーを設定
  const openSettingsButton = document.getElementById('openSettings');
  if (openSettingsButton) {
    openSettingsButton.addEventListener('click', openSettings);
  }
  
  // ストレージ監視を設定
  setupStorageListener();
  
  // ポップアップを初期化
  initializePopup();
});

// ===== エラーハンドリング =====

/**
 * 未処理のエラーをキャッチします
 */
window.addEventListener('error', (event) => {
  console.error('Popup error:', event.error);
  updateStatus('エラーが発生しました', true);
});

/**
 * 未処理のPromise拒否をキャッチします
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Popup unhandled rejection:', event.reason);
  updateStatus('データの処理でエラーが発生しました', true);
});