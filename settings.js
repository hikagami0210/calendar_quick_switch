/**
 * Google カレンダーグループ拡張機能 - 設定ページスクリプト
 * グループ管理、インポート/エクスポート、設定変更の機能を提供します
 */

// ===== 定数 =====

const STORAGE_KEYS = {
  GROUPS: 'calendarGroups',
  SETTINGS: 'settings'
};

const DEFAULT_SETTINGS = {
  disableOthers: true
};

// ===== グローバル変数 =====

let currentGroups = [];
let currentSettings = DEFAULT_SETTINGS;
let editingGroupId = null;
let editingCalendars = [];

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
 * カレンダーグループを保存します
 * @param {Array} groups - 保存するグループの配列
 * @returns {Promise<void>}
 */
async function saveGroups(groups) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.GROUPS]: groups
    });
    console.log('Groups saved successfully');
  } catch (error) {
    console.error('Failed to save groups:', error);
    throw error;
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

/**
 * 設定を保存します
 * @param {Object} settings - 保存する設定
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: settings
    });
    console.log('Settings saved successfully');
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

// ===== UI更新関数 =====

/**
 * グループ一覧を更新します
 */
function updateGroupsList() {
  const groupsList = document.getElementById('groupsList');
  const groupsCount = document.getElementById('groupsCount');
  
  // カウントを更新
  if (currentGroups.length === 0) {
    groupsCount.textContent = '保存されたグループがありません';
  } else {
    groupsCount.textContent = `${currentGroups.length} 件のグループ`;
  }
  
  // リストを更新
  if (currentGroups.length === 0) {
    groupsList.innerHTML = `
      <div class="no-groups">
        <p>保存されたグループがありません</p>
        <p class="suggestion">Google Calendarページで右クリックしてグループを作成してください</p>
      </div>
    `;
    return;
  }
  
  groupsList.innerHTML = '';
  
  currentGroups.forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    
    const createdDate = new Date(group.createdAt).toLocaleDateString('ja-JP');
    const updatedDate = new Date(group.updatedAt).toLocaleDateString('ja-JP');
    
    groupItem.innerHTML = `
      <div class="group-info">
        <div class="group-name">${escapeHtml(group.name)}</div>
        <div class="group-calendars">
          ${group.calendars && group.calendars.length > 0 
            ? escapeHtml(group.calendars.join(', '))
            : 'カレンダーなし'
          }
        </div>
        <div class="group-meta">
          作成: ${createdDate}${updatedDate !== createdDate ? ` | 更新: ${updatedDate}` : ''}
        </div>
      </div>
      <div class="group-actions">
        <button class="btn edit" data-action="edit" data-group-id="${group.id}">編集</button>
        <button class="btn delete" data-action="delete" data-group-id="${group.id}">削除</button>
      </div>
    `;
    
    // イベントリスナーを設定
    const editBtn = groupItem.querySelector('.btn.edit');
    const deleteBtn = groupItem.querySelector('.btn.delete');
    
    editBtn.addEventListener('click', () => editGroup(group.id));
    deleteBtn.addEventListener('click', () => confirmDeleteGroup(group.id));
    
    groupsList.appendChild(groupItem);
  });
}

/**
 * 設定UIを更新します
 */
function updateSettingsUI() {
  const disableOthersRadio = document.querySelector('input[name="disableOthers"][value="true"]');
  const keepOthersRadio = document.querySelector('input[name="disableOthers"][value="false"]');
  
  if (currentSettings.disableOthers) {
    disableOthersRadio.checked = true;
    document.getElementById('disableOthersOption').classList.add('selected');
    document.getElementById('keepOthersOption').classList.remove('selected');
  } else {
    keepOthersRadio.checked = true;
    document.getElementById('keepOthersOption').classList.add('selected');
    document.getElementById('disableOthersOption').classList.remove('selected');
  }
}

// ===== ユーティリティ関数 =====

/**
 * HTMLエスケープを行います
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたテキスト
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * IDからグループを検索します
 * @param {string} groupId - 検索するグループのID
 * @returns {Object|null} 見つかったグループ、または null
 */
function findGroupById(groupId) {
  return currentGroups.find(group => group.id === groupId) || null;
}

/**
 * ファイルダウンロードを実行します
 * @param {string} content - ダウンロードするコンテンツ
 * @param {string} filename - ファイル名
 * @param {string} contentType - コンテンツタイプ
 */
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * 確認ダイアログを表示します
 * @param {string} message - 確認メッセージ
 * @returns {boolean} ユーザーの選択結果
 */
function showConfirm(message) {
  return confirm(message);
}

/**
 * アラートを表示します
 * @param {string} message - アラートメッセージ
 */
function showAlert(message) {
  alert(message);
}

// ===== カレンダー編集関数 =====

/**
 * カレンダーエディターを更新します
 */
function updateCalendarEditor() {
  const calendarsEditor = document.getElementById('calendarsEditor');
  
  if (editingCalendars.length === 0) {
    calendarsEditor.innerHTML = '<div class="calendar-item">カレンダーなし</div>';
    return;
  }
  
  calendarsEditor.innerHTML = '';
  
  editingCalendars.forEach((calendar, index) => {
    const calendarItem = document.createElement('div');
    calendarItem.className = 'calendar-edit-item';
    calendarItem.innerHTML = `
      <div class="calendar-display-name" data-index="${index}">${escapeHtml(calendar)}</div>
      <div class="calendar-actions">
        <button class="calendar-btn edit" data-action="edit-calendar" data-index="${index}">編集</button>
        <button class="calendar-btn delete" data-action="delete-calendar" data-index="${index}">削除</button>
      </div>
    `;
    
    // イベントリスナーを設定
    const editBtn = calendarItem.querySelector('[data-action="edit-calendar"]');
    const deleteBtn = calendarItem.querySelector('[data-action="delete-calendar"]');
    
    editBtn.addEventListener('click', () => startCalendarEdit(index));
    deleteBtn.addEventListener('click', () => deleteCalendar(index));
    
    calendarsEditor.appendChild(calendarItem);
  });
}

/**
 * カレンダーの編集を開始します
 * @param {number} index - 編集するカレンダーのインデックス
 */
function startCalendarEdit(index) {
  // 正しいカレンダーアイテムを見つける
  const allItems = document.querySelectorAll('.calendar-edit-item');
  const calendarItem = allItems[index];
  
  if (!calendarItem) {
    console.error('Calendar item not found at index:', index);
    return;
  }
  
  const currentName = editingCalendars[index];
  console.log('Starting edit for calendar:', currentName, 'at index:', index);
  
  calendarItem.innerHTML = `
    <input type="text" class="calendar-input" value="${escapeHtml(currentName)}" data-index="${index}" />
    <div class="calendar-actions">
      <button class="calendar-btn save" data-action="save-calendar" data-index="${index}">保存</button>
      <button class="calendar-btn cancel" data-action="cancel-calendar" data-index="${index}">取消</button>
    </div>
  `;
  
  // イベントリスナーを設定
  const input = calendarItem.querySelector('.calendar-input');
  const saveBtn = calendarItem.querySelector('[data-action="save-calendar"]');
  const cancelBtn = calendarItem.querySelector('[data-action="cancel-calendar"]');
  
  if (!input || !saveBtn || !cancelBtn) {
    console.error('Failed to find elements in calendar item');
    return;
  }
  
  saveBtn.addEventListener('click', () => {
    console.log('Save button clicked for index:', index);
    saveCalendarEdit(index);
  });
  cancelBtn.addEventListener('click', () => {
    console.log('Cancel button clicked for index:', index);
    cancelCalendarEdit(index);
  });
  
  // Enterキーで保存、Escapeキーでキャンセル
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      console.log('Enter key pressed for index:', index);
      saveCalendarEdit(index);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      console.log('Escape key pressed for index:', index);
      cancelCalendarEdit(index);
    }
  });
  
  input.focus();
  input.select();
}

/**
 * カレンダーの編集を保存します
 * @param {number} index - 保存するカレンダーのインデックス
 */
function saveCalendarEdit(index) {
  console.log('Saving calendar edit for index:', index);
  
  const allItems = document.querySelectorAll('.calendar-edit-item');
  const calendarItem = allItems[index];
  
  if (!calendarItem) {
    console.error('Calendar item not found at index:', index);
    return;
  }
  
  const input = calendarItem.querySelector('.calendar-input');
  
  if (!input) {
    console.error('Input not found in calendar item at index:', index);
    return;
  }
  
  const newName = input.value.trim();
  console.log('New name:', newName, 'Original name:', editingCalendars[index]);
  
  if (!newName) {
    showAlert('カレンダー名を入力してください');
    input.focus();
    return;
  }
  
  if (newName.length > 100) {
    showAlert('カレンダー名は100文字以内で入力してください');
    input.focus();
    return;
  }
  
  // 重複チェック（現在編集中のもの以外）
  const isDuplicate = editingCalendars.some((name, i) => i !== index && name === newName);
  if (isDuplicate) {
    showAlert('同じ名前のカレンダーが既に存在します');
    input.focus();
    return;
  }
  
  // 配列を更新
  editingCalendars[index] = newName;
  console.log('Updated editingCalendars:', editingCalendars);
  
  // UIを更新
  updateCalendarEditor();
}

/**
 * カレンダーの編集をキャンセルします
 * @param {number} index - キャンセルするカレンダーのインデックス
 */
function cancelCalendarEdit(index) {
  updateCalendarEditor();
}

/**
 * カレンダーを削除します
 * @param {number} index - 削除するカレンダーのインデックス
 */
function deleteCalendar(index) {
  const calendarName = editingCalendars[index];
  const confirmed = showConfirm(`カレンダー「${calendarName}」を削除してもよろしいですか？`);
  
  if (confirmed) {
    editingCalendars.splice(index, 1);
    updateCalendarEditor();
  }
}

/**
 * 新しいカレンダーを追加します
 */
function addNewCalendar() {
  const input = document.getElementById('newCalendarName');
  const newName = input.value.trim();
  
  if (!newName) {
    showAlert('カレンダー名を入力してください');
    input.focus();
    return;
  }
  
  if (newName.length > 100) {
    showAlert('カレンダー名は100文字以内で入力してください');
    input.focus();
    return;
  }
  
  // 重複チェック
  const isDuplicate = editingCalendars.some(name => name === newName);
  if (isDuplicate) {
    showAlert('同じ名前のカレンダーが既に存在します');
    input.focus();
    return;
  }
  
  editingCalendars.push(newName);
  input.value = '';
  updateCalendarEditor();
  
  // 新しく追加されたカレンダーが見えるようにスクロール
  const calendarsEditor = document.getElementById('calendarsEditor');
  calendarsEditor.scrollTop = calendarsEditor.scrollHeight;
}

// ===== グループ管理関数 =====

/**
 * グループを編集します
 * @param {string} groupId - 編集するグループのID
 */
function editGroup(groupId) {
  const group = findGroupById(groupId);
  if (!group) {
    showAlert('グループが見つかりません');
    return;
  }
  
  editingGroupId = groupId;
  editingCalendars = [...(group.calendars || [])];
  
  // モーダルの内容を設定
  document.getElementById('modalTitle').textContent = 'グループを編集';
  document.getElementById('groupName').value = group.name;
  
  // カレンダーエディターを表示
  updateCalendarEditor();
  
  // エラーメッセージをクリア
  document.getElementById('nameError').textContent = '';
  
  // モーダルを表示
  document.getElementById('editModal').classList.add('show');
  document.getElementById('groupName').focus();
};

/**
 * グループの削除を確認します
 * @param {string} groupId - 削除するグループのID
 */
function confirmDeleteGroup(groupId) {
  const group = findGroupById(groupId);
  if (!group) {
    showAlert('グループが見つかりません');
    return;
  }
  
  const confirmed = showConfirm(
    `グループ「${group.name}」を削除してもよろしいですか？\n\nこの操作は取り消せません。`
  );
  
  if (confirmed) {
    deleteGroup(groupId);
  }
};

/**
 * グループを削除します
 * @param {string} groupId - 削除するグループのID
 */
async function deleteGroup(groupId) {
  try {
    currentGroups = currentGroups.filter(group => group.id !== groupId);
    await saveGroups(currentGroups);
    updateGroupsList();
    console.log('Group deleted successfully:', groupId);
  } catch (error) {
    console.error('Failed to delete group:', error);
    showAlert('グループの削除に失敗しました');
  }
}

/**
 * グループを保存します
 */
async function saveGroup() {
  const nameInput = document.getElementById('groupName');
  const nameError = document.getElementById('nameError');
  const groupName = nameInput.value.trim();
  
  // バリデーション
  if (!groupName) {
    nameError.textContent = 'グループ名を入力してください';
    nameInput.focus();
    return;
  }
  
  if (groupName.length > 50) {
    nameError.textContent = 'グループ名は50文字以内で入力してください';
    nameInput.focus();
    return;
  }
  
  // 重複チェック（編集中のグループは除外）
  const isDuplicate = currentGroups.some(group => 
    group.id !== editingGroupId && group.name === groupName
  );
  
  if (isDuplicate) {
    nameError.textContent = '同じ名前のグループが既に存在します';
    nameInput.focus();
    return;
  }
  
  try {
    // グループを更新
    const groupIndex = currentGroups.findIndex(group => group.id === editingGroupId);
    if (groupIndex !== -1) {
      currentGroups[groupIndex] = {
        ...currentGroups[groupIndex],
        name: groupName,
        calendars: [...editingCalendars],
        updatedAt: Date.now()
      };
      
      await saveGroups(currentGroups);
      updateGroupsList();
      closeModal();
      console.log('Group updated successfully:', editingGroupId);
    } else {
      showAlert('グループが見つかりません');
    }
  } catch (error) {
    console.error('Failed to save group:', error);
    showAlert('グループの保存に失敗しました');
  }
}

/**
 * 新しいグループを追加します
 */
function addNewGroup() {
  showAlert('新しいグループの追加は、Google Calendarページで右クリックして行ってください。');
}

// ===== モーダル管理関数 =====

/**
 * モーダルを閉じます
 */
function closeModal() {
  document.getElementById('editModal').classList.remove('show');
  editingGroupId = null;
  editingCalendars = [];
  document.getElementById('nameError').textContent = '';
  document.getElementById('newCalendarName').value = '';
}

// ===== インポート/エクスポート関数 =====

/**
 * グループデータをエクスポートします
 */
function exportGroups() {
  if (currentGroups.length === 0) {
    showAlert('エクスポートするグループがありません');
    return;
  }
  
  try {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      groups: currentGroups,
      settings: currentSettings
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const filename = `calendar-groups-${new Date().toISOString().split('T')[0]}.json`;
    
    downloadFile(jsonString, filename, 'application/json');
    console.log('Groups exported successfully');
  } catch (error) {
    console.error('Failed to export groups:', error);
    showAlert('エクスポートに失敗しました');
  }
};

/**
 * グループデータをインポートします
 */
function importGroups() {
  const fileInput = document.getElementById('importFile');
  fileInput.click();
}

/**
 * ファイル選択を処理します
 * @param {Event} event - ファイル選択イベント
 */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importData = JSON.parse(e.target.result);
      processImportData(importData);
    } catch (error) {
      console.error('Failed to parse import file:', error);
      showAlert('ファイルの形式が正しくありません。有効なJSONファイルを選択してください。');
    }
  };
  
  reader.readAsText(file);
  
  // ファイル入力をリセット
  event.target.value = '';
}

/**
 * インポートデータを処理します
 * @param {Object} importData - インポートするデータ
 */
async function processImportData(importData) {
  try {
    // データ形式の検証
    if (!importData.groups || !Array.isArray(importData.groups)) {
      showAlert('ファイルの形式が正しくありません。groupsプロパティが見つかりません。');
      return;
    }
    
    // グループデータの検証
    for (const group of importData.groups) {
      if (!group.id || !group.name || !group.calendars || !Array.isArray(group.calendars)) {
        showAlert('ファイルに無効なグループデータが含まれています。');
        return;
      }
    }
    
    const importCount = importData.groups.length;
    
    // 確認ダイアログ
    const shouldOverwrite = showConfirm(
      `${importCount} 件のグループをインポートします。\n\n既存のグループは上書きされますがよろしいですか？`
    );
    
    if (!shouldOverwrite) return;
    
    // インポート実行
    currentGroups = importData.groups;
    await saveGroups(currentGroups);
    
    // 設定もインポート（存在する場合）
    if (importData.settings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...importData.settings };
      await saveSettings(currentSettings);
      updateSettingsUI();
    }
    
    updateGroupsList();
    showAlert(`${importCount} 件のグループを正常にインポートしました。`);
    console.log('Groups imported successfully:', importCount);
    
  } catch (error) {
    console.error('Failed to import groups:', error);
    showAlert('インポートに失敗しました。ファイルを確認してください。');
  }
}

// ===== 設定関数 =====

/**
 * 設定を変更します
 * @param {string} settingName - 設定名
 * @param {any} value - 設定値
 */
async function changeSetting(settingName, value) {
  try {
    currentSettings[settingName] = value;
    await saveSettings(currentSettings);
    updateSettingsUI();
    console.log('Setting changed:', settingName, value);
  } catch (error) {
    console.error('Failed to save setting:', error);
    showAlert('設定の保存に失敗しました');
  }
}

// ===== イベントリスナー設定 =====

/**
 * DOMが読み込まれた後に実行される初期化処理
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Settings page DOM loaded');
  
  try {
    // データを読み込み
    currentGroups = await loadGroups();
    currentSettings = await loadSettings();
    
    // UIを更新
    updateGroupsList();
    updateSettingsUI();
    
    // イベントリスナーを設定
    setupEventListeners();
    
    console.log('Settings page initialized successfully');
    console.log('Groups:', currentGroups.length);
    console.log('Settings:', currentSettings);
    
  } catch (error) {
    console.error('Failed to initialize settings page:', error);
    showAlert('データの読み込みに失敗しました');
  }
});

/**
 * イベントリスナーを設定します
 */
function setupEventListeners() {
  // グループ追加ボタン
  document.getElementById('addGroupBtn').addEventListener('click', addNewGroup);
  
  // エクスポートボタン
  document.getElementById('exportBtn').addEventListener('click', exportGroups);
  
  // インポートボタン
  document.getElementById('importBtn').addEventListener('click', importGroups);
  
  // ファイル入力
  document.getElementById('importFile').addEventListener('change', handleFileSelect);
  
  // カレンダー追加ボタン
  document.getElementById('addCalendarBtn').addEventListener('click', addNewCalendar);
  
  // カレンダー追加テキストボックスでEnterキー
  document.getElementById('newCalendarName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addNewCalendar();
    }
  });
  
  // モーダル関連
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveGroup);
  
  // モーダル外クリックで閉じる
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
      closeModal();
    }
  });
  
  // Escapeキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
  
  // 設定変更
  document.querySelectorAll('input[name="disableOthers"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const value = e.target.value === 'true';
      changeSetting('disableOthers', value);
    });
  });
  
  // ラジオオプションのクリック
  document.querySelectorAll('.radio-option').forEach(option => {
    option.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const radio = option.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }
    });
  });
  
  // ストレージ変更の監視
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes[STORAGE_KEYS.GROUPS]) {
        console.log('Groups changed, updating list');
        currentGroups = changes[STORAGE_KEYS.GROUPS].newValue || [];
        updateGroupsList();
      }
      
      if (changes[STORAGE_KEYS.SETTINGS]) {
        console.log('Settings changed, updating UI');
        currentSettings = { ...DEFAULT_SETTINGS, ...changes[STORAGE_KEYS.SETTINGS].newValue };
        updateSettingsUI();
      }
    }
  });
}

// ===== エラーハンドリング =====

/**
 * 未処理のエラーをキャッチします
 */
window.addEventListener('error', (event) => {
  console.error('Settings page error:', event.error);
});

/**
 * 未処理のPromise拒否をキャッチします
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('Settings page unhandled rejection:', event.reason);
});