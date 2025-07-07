/**
 * Google カレンダーグループ拡張機能 - コンテンツスクリプト
 * Google Calendarページでのカレンダー操作とグループ管理を行います
 */

// ===== 型定義 =====

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

interface Settings {
  disableOthers: boolean;
}

// ===== 定数 =====

const CT_STORAGE_KEYS = {
  GROUPS: "calendarGroups",
  SETTINGS: "settings",
} as const;

const CT_DEFAULT_SETTINGS: Settings = {
  disableOthers: true,
};

// カレンダーセクションを探すためのセレクタ（優先度順）
const CT_CALENDAR_SELECTORS = [
  '[aria-label="他のカレンダー"]',
  '[aria-label="Other calendars"]',
  '[aria-label*="カレンダー"]',
  '[aria-label*="calendar"]',
  '[data-testid*="calendar"]',
  '[role="tree"]',
  '[role="group"]',
] as const;

const CT_CHECKBOX_SELECTOR = 'input[type="checkbox"]';

// ===== ユーティリティ関数 =====

/**
 * 指定されたミリ秒間待機します
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
function ctSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ユニークIDを生成します
 * @returns {string} 生成されたID
 */
function ctGenerateId(): string {
  return crypto.randomUUID();
}

// ===== ストレージ関数 =====

/**
 * カレンダーグループを保存します
 * @param {CalendarGroup[]} groups - 保存するグループの配列
 * @returns {Promise<void>}
 */
async function ctSaveGroups(groups: CalendarGroup[]): Promise<void> {
  try {
    await chrome.storage.local.set({
      [CT_STORAGE_KEYS.GROUPS]: groups,
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
async function ctLoadGroups(): Promise<CalendarGroup[]> {
  try {
    const result = await chrome.storage.local.get(CT_STORAGE_KEYS.GROUPS);
    return result[CT_STORAGE_KEYS.GROUPS] || [];
  } catch (error) {
    console.error("Failed to load groups:", error);
    return [];
  }
}

/**
 * 設定を読み込みます
 * @returns {Promise<Settings>} 保存されている設定（デフォルト値を含む）
 */
async function ctLoadSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(CT_STORAGE_KEYS.SETTINGS);
    return { ...CT_DEFAULT_SETTINGS, ...result[CT_STORAGE_KEYS.SETTINGS] };
  } catch (error) {
    console.error("Failed to load settings:", error);
    return CT_DEFAULT_SETTINGS;
  }
}

/**
 * 新しいグループを追加します
 * @param {CalendarGroup} group - 追加するグループ
 * @returns {Promise<void>}
 */
async function ctAddGroup(group: CalendarGroup): Promise<void> {
  const groups = await ctLoadGroups();
  groups.push(group);
  await ctSaveGroups(groups);
}

// ===== DOM操作関数 =====

/**
 * カレンダーセクションを探します
 * 複数のセレクタパターンを試行し、チェックボックスを含むセクションを返します
 * @returns {Promise<HTMLElement | null>} 見つかったカレンダーセクション、または null
 */
async function ctFindCalendarSection(): Promise<HTMLElement | null> {
  const maxRetries = 10;
  const retryDelay = 500;

  for (let i = 0; i < maxRetries; i++) {
    // 各セレクタを試行
    for (const selector of CT_CALENDAR_SELECTORS) {
      const section = document.querySelector(selector) as HTMLElement;
      if (section) {
        // セクション内にチェックボックスがあるかチェック
        const hasCheckboxes =
          section.querySelectorAll(CT_CHECKBOX_SELECTOR).length > 0;
        if (hasCheckboxes) {
          console.log(`カレンダーセクションを発見: ${selector}`);
          return section;
        }
      }
    }

    // フォールバック: ページ全体からカレンダー用チェックボックスを探す
    const allCheckboxes = document.querySelectorAll(CT_CHECKBOX_SELECTOR);
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
        const childCheckboxes = parent.querySelectorAll(CT_CHECKBOX_SELECTOR);
        if (childCheckboxes.length >= allCheckboxes.length * 0.5) {
          console.log("共通親要素をカレンダーセクションとして使用");
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    await ctSleep(retryDelay);
  }

  console.warn(
    "カレンダーセクションが見つかりませんでした。利用可能なチェックボックス:",
    document.querySelectorAll(CT_CHECKBOX_SELECTOR).length
  );
  return null;
}

/**
 * チェックボックス要素からカレンダー名を取得します
 * 複数の方法を試行してラベルテキストを取得します
 * @param {HTMLInputElement} checkbox - 対象のチェックボックス要素
 * @returns {string | null} カレンダー名、または null
 */
function ctGetCalendarLabel(checkbox: HTMLInputElement): string | null {
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
async function ctGetCalendarCheckboxes(): Promise<CalendarCheckbox[]> {
  const section = await ctFindCalendarSection();
  if (!section) {
    return [];
  }

  const checkboxes = Array.from(
    section.querySelectorAll(CT_CHECKBOX_SELECTOR)
  ) as HTMLInputElement[];
  const calendarCheckboxes: CalendarCheckbox[] = [];

  for (const checkbox of checkboxes) {
    const label = ctGetCalendarLabel(checkbox);
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
function ctToggleCheckbox(checkbox: HTMLInputElement, checked: boolean): void {
  if (checkbox.checked !== checked) {
    checkbox.click();
  }
}

/**
 * DOM構造を詳細に調査するデバッグ関数
 * @returns {void}
 */
function ctAnalyzeDOMStructure(): void {
  console.log("=== DOM構造調査開始 ===");

  // 1. すべてのチェックボックスを探す
  const allCheckboxes = Array.from(
    document.querySelectorAll('input[type="checkbox"]')
  );
  console.log(`総チェックボックス数: ${allCheckboxes.length}`);

  // 2. スクロール可能な要素を探す
  const scrollableElements = Array.from(document.querySelectorAll("*")).filter(
    (el) => {
      const style = window.getComputedStyle(el);
      return (
        style.overflow === "auto" ||
        style.overflow === "scroll" ||
        style.overflowY === "auto" ||
        style.overflowY === "scroll"
      );
    }
  );
  console.log(`スクロール可能な要素数: ${scrollableElements.length}`);
  scrollableElements.forEach((el, index) => {
    console.log(`スクロール要素${index}:`, el.tagName, el.className, el.id);
  });

  // 3. サイドバー関連要素を探す
  const sidebarSelectors = [
    '[data-testid="sidebar"]',
    '[role="complementary"]',
    '[role="navigation"]',
    "nav",
    ".sidebar",
    "#sidebar",
  ];

  sidebarSelectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`${selector} が ${elements.length} 個見つかりました`);
    }
  });

  // 4. ドロワーヘッダーとスクロールコンテナを探す
  const drawerHeaders = Array.from(document.querySelectorAll("h1")).filter(
    (h1) =>
      h1.textContent?.includes("ドロワー") || h1.textContent?.includes("Drawer")
  );

  console.log(`ドロワーヘッダー数: ${drawerHeaders.length}`);
  drawerHeaders.forEach((header, index) => {
    console.log(`ドロワーヘッダー${index}:`, header.textContent);
    const parent = header.parentElement;
    if (parent) {
      console.log(
        `  親要素: ${parent.tagName}.${parent.className} #${parent.id}`
      );
      const style = window.getComputedStyle(parent);
      console.log(`  スクロール可能: ${style.overflow}, ${style.overflowY}`);
    }
  });

  // 5. カレンダーチェックボックスの親要素構造を調査
  allCheckboxes.slice(0, 3).forEach((checkbox, index) => {
    console.log(`チェックボックス${index}の親要素構造:`);
    let parent = checkbox.parentElement;
    let level = 0;
    while (parent && level < 5) {
      console.log(
        `  レベル${level}: ${parent.tagName}.${parent.className} #${parent.id}`
      );
      parent = parent.parentElement;
      level++;
    }
  });

  console.log("=== DOM構造調査終了 ===");
}

/**
 * ドロワーのスクロールコンテナを見つける
 * @returns {HTMLElement | null} ドロワーのスクロールコンテナ
 */
function ctFindDrawerScrollContainer(): HTMLElement | null {
  // 「ドロワー」のh1要素を探す
  const drawerHeaders = Array.from(document.querySelectorAll("h1")).filter(
    (h1) =>
      h1.textContent?.includes("ドロワー") || h1.textContent?.includes("Drawer")
  );

  if (drawerHeaders.length > 0) {
    const drawerHeader = drawerHeaders[0];
    console.log("🎯 ドロワーヘッダー発見:", drawerHeader);

    // h1の一つ上のdivを取得
    const scrollContainer = drawerHeader.parentElement;
    if (scrollContainer && scrollContainer.tagName === "DIV") {
      console.log("✅ ドロワースクロールコンテナ発見:", scrollContainer);
      return scrollContainer;
    }
  }

  console.log("⚠️ ドロワーヘッダーが見つかりません。代替手段を使用します");
  return null;
}

/**
 * ドロワー専用スクロール関数
 * @param {HTMLElement} element - スクロール対象の要素
 * @returns {Promise<void>}
 */
async function ctScrollToElementInDrawer(element: HTMLElement): Promise<void> {
  console.log("=== ドロワースクロール開始 ===");
  console.log("対象要素:", element);

  // 1. 要素の現在位置を確認
  const rect = element.getBoundingClientRect();
  console.log("要素位置:", {
    top: rect.top,
    bottom: rect.bottom,
    visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
  });

  if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
    console.log("✅ 要素は既に表示されています");
    return;
  }

  // 2. ドロワーのスクロールコンテナを探す
  const drawerContainer = ctFindDrawerScrollContainer();

  if (drawerContainer) {
    console.log("🎯 ドロワーコンテナでスクロール実行");

    // ドロワーコンテナ内での要素の位置を計算
    const containerRect = drawerContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // スクロール量を計算（要素を中央に表示）
    const scrollTop =
      drawerContainer.scrollTop +
      (elementRect.top - containerRect.top) -
      containerRect.height / 2;

    console.log(`スクロール実行: ${scrollTop}px`);

    drawerContainer.scrollTo({
      top: scrollTop,
      behavior: "smooth",
    });

    await ctSleep(1000);

    // 結果確認
    const newRect = element.getBoundingClientRect();
    console.log("スクロール後の要素位置:", {
      top: newRect.top,
      bottom: newRect.bottom,
      visible: newRect.top >= 0 && newRect.bottom <= window.innerHeight,
    });

    if (newRect.top >= 0 && newRect.bottom <= window.innerHeight) {
      console.log("✅ ドロワースクロール成功");
      return;
    }
  }

  // 3. フォールバック: 通常のscrollIntoView
  console.log("⚠️ フォールバック: scrollIntoView使用");
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  await ctSleep(1000);

  // 最終結果確認
  const finalRect = element.getBoundingClientRect();
  console.log("最終的な要素位置:", {
    top: finalRect.top,
    bottom: finalRect.bottom,
    visible: finalRect.top >= 0 && finalRect.bottom <= window.innerHeight,
  });

  console.log("=== ドロワースクロール終了 ===");
}

/**
 * 指定されたラベルのチェックボックスを検索します（シンプル版）
 * @param {string} label - 検索するカレンダーのラベル
 * @returns {HTMLInputElement | null} 見つかったチェックボックス要素、またはnull
 */
function ctFindCheckboxByLabel(label: string): HTMLInputElement | null {
  const allCheckboxes = Array.from(
    document.querySelectorAll(CT_CHECKBOX_SELECTOR)
  ) as HTMLInputElement[];

  const normalizedTargetLabel = label.trim();
  console.log(`🔍 検索開始: "${normalizedTargetLabel}"`);

  for (const checkbox of allCheckboxes) {
    const checkboxLabel = ctGetCalendarLabel(checkbox);
    if (checkboxLabel) {
      const normalizedCheckboxLabel = checkboxLabel.trim();

      if (normalizedCheckboxLabel === normalizedTargetLabel) {
        console.log(`✅ 発見: "${normalizedCheckboxLabel}"`);
        return checkbox;
      }
    }
  }

  console.log(`❌ 未発見: "${normalizedTargetLabel}"`);
  return null;
}

/**
 * 仮想スクロールでカレンダーを探してスクロールで表示する（新実装）
 * @param {string} label - 検索するカレンダーのラベル
 * @returns {Promise<HTMLInputElement | null>} 見つかったチェックボックス要素、またはnull
 */
async function ctFindAndScrollToCheckbox(
  label: string
): Promise<HTMLInputElement | null> {
  console.log(`🎯 カレンダー検索開始: "${label}"`);

  // 1. まず現在表示されている範囲で検索
  let checkbox = ctFindCheckboxByLabel(label);
  if (checkbox) {
    console.log("✅ 既に表示範囲内にあります");
    return checkbox;
  }

  // 2. ドロワーコンテナを取得
  const drawerContainer = ctFindDrawerScrollContainer();
  if (!drawerContainer) {
    console.log("❌ ドロワーコンテナが見つかりません");
    return null;
  }

  console.log("🔄 仮想スクロール開始 - 段階的にスクロールして要素を探します");

  // 3. 段階的にスクロールして新しいDOM要素をレンダリングさせる
  const maxScrollAttempts = 10; // 最大スクロール回数
  const scrollStep = 200; // 各ステップでのスクロール量
  let currentScrollTop = drawerContainer.scrollTop;

  for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
    console.log(`📜 スクロール試行 ${attempt + 1}/${maxScrollAttempts}`);

    // スクロール実行
    currentScrollTop += scrollStep;
    drawerContainer.scrollTop = currentScrollTop;

    console.log(`スクロール位置: ${currentScrollTop}px`);

    // DOM要素のレンダリングを待機
    await ctSleep(300);

    // 新しくレンダリングされた要素を検索
    checkbox = ctFindCheckboxByLabel(label);
    if (checkbox) {
      console.log(`✅ スクロール試行 ${attempt + 1} で発見!`);
      return checkbox;
    }

    // スクロール限界チェック
    if (
      drawerContainer.scrollTop >=
      drawerContainer.scrollHeight - drawerContainer.clientHeight
    ) {
      console.log("📜 スクロール限界に到達");
      break;
    }
  }

  // 4. 下方向で見つからない場合、上方向もチェック
  console.log("🔄 上方向スクロール開始");
  currentScrollTop = drawerContainer.scrollTop;

  for (let attempt = 0; attempt < maxScrollAttempts; attempt++) {
    console.log(`📜 上方向スクロール試行 ${attempt + 1}/${maxScrollAttempts}`);

    // 上方向にスクロール
    currentScrollTop = Math.max(0, currentScrollTop - scrollStep);
    drawerContainer.scrollTop = currentScrollTop;

    console.log(`スクロール位置: ${currentScrollTop}px`);

    // DOM要素のレンダリングを待機
    await ctSleep(300);

    // 新しくレンダリングされた要素を検索
    checkbox = ctFindCheckboxByLabel(label);
    if (checkbox) {
      console.log(`✅ 上方向スクロール試行 ${attempt + 1} で発見!`);
      return checkbox;
    }

    // スクロール限界チェック
    if (currentScrollTop <= 0) {
      console.log("📜 上方向スクロール限界に到達");
      break;
    }
  }

  console.log(`❌ "${label}" は仮想スクロールでも見つかりませんでした`);
  return null;
}

/**
 * カレンダーの読み込み完了を待機します
 * @returns {Promise<void>}
 * @throws {Error} タイムアウト時にエラーを投げます
 */
async function ctWaitForCalendarLoad(): Promise<void> {
  const maxWait = 30000; // 30秒
  const checkInterval = 1000; // 1秒間隔
  const startTime = Date.now();

  console.log("カレンダーの読み込みを待機しています...");

  while (Date.now() - startTime < maxWait) {
    // デバッグ情報を出力
    const allCheckboxes = document.querySelectorAll(CT_CHECKBOX_SELECTOR);
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

    const section = await ctFindCalendarSection();
    if (section) {
      const checkboxes = await ctGetCalendarCheckboxes();
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
    await ctSleep(checkInterval);
  }

  // タイムアウト時の詳細情報
  const finalCheckboxCount =
    document.querySelectorAll(CT_CHECKBOX_SELECTOR).length;
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
 * スクロール制御と要素待機機能を使用して、画面外のカレンダーも処理します
 * @param {CalendarGroup} group - 適用するグループ
 * @param {boolean} [disableOthers=true] - グループ外のカレンダーを無効にするかどうか
 * @returns {Promise<void>}
 */
async function ctApplyCalendarGroup(
  group: CalendarGroup,
  disableOthers: boolean = true
): Promise<void> {
  console.log(`グループ "${group.name}" を適用中...`);
  console.log("対象カレンダー:", group.calendars);

  // まず現在表示されているチェックボックスを取得
  const initialCheckboxes = await ctGetCalendarCheckboxes();

  if (initialCheckboxes.length === 0) {
    console.warn("チェックボックスが見つかりませんでした");
    return;
  }

  // 処理済みのカレンダーを追跡
  const processedCalendars = new Set<string>();

  // 現在表示されているチェックボックスを処理
  for (const checkbox of initialCheckboxes) {
    const shouldBeChecked = group.calendars.includes(checkbox.label);

    if (shouldBeChecked && !checkbox.checked) {
      ctToggleCheckbox(checkbox.element, true);
      console.log(`カレンダー "${checkbox.label}" を有効にしました`);
    } else if (!shouldBeChecked && checkbox.checked && disableOthers) {
      ctToggleCheckbox(checkbox.element, false);
      console.log(`カレンダー "${checkbox.label}" を無効にしました`);
    }

    processedCalendars.add(checkbox.label);
  }

  // グループ内でまだ処理されていないカレンダーを処理
  const unprocessedCalendars = group.calendars.filter(
    (calendar) => !processedCalendars.has(calendar)
  );

  if (unprocessedCalendars.length > 0) {
    console.log(
      `画面外のカレンダーを処理中: ${unprocessedCalendars.join(", ")}`
    );

    for (const calendarLabel of unprocessedCalendars) {
      try {
        // 新実装：スクロールで検索
        const checkbox = await ctFindAndScrollToCheckbox(calendarLabel);

        if (checkbox) {
          // チェックボックスを有効にする
          if (!checkbox.checked) {
            ctToggleCheckbox(checkbox, true);
            console.log(`✅ スクロール後有効化: "${calendarLabel}"`);
          }
          processedCalendars.add(calendarLabel);
        } else {
          console.warn(`⚠️ カレンダーが見つかりません: "${calendarLabel}"`);
        }
      } catch (error) {
        console.error(
          `カレンダー "${calendarLabel}" の処理中にエラーが発生しました:`,
          error
        );
      }
    }
  }

  // 処理結果のサマリーを表示
  const processedCount = processedCalendars.size;
  const targetCount = group.calendars.length;

  console.log(
    `グループ適用完了: ${processedCount}/${targetCount} のカレンダーを処理しました`
  );

  if (processedCount < targetCount) {
    const missedCalendars = group.calendars.filter(
      (calendar) => !processedCalendars.has(calendar)
    );
    console.warn(`処理できなかったカレンダー: ${missedCalendars.join(", ")}`);
  }
}

/**
 * 現在選択されているカレンダー名の配列を取得します
 * @returns {Promise<string[]>} 選択中のカレンダー名の配列
 */
async function ctGetCurrentlySelectedCalendars(): Promise<string[]> {
  const checkboxes = await ctGetCalendarCheckboxes();
  return checkboxes
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.label);
}

// ===== UI関数 =====

/**
 * 通知メッセージを表示します
 * @param {string} message - 表示するメッセージ
 */
function ctShowNotification(message: string): void {
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
function ctShowInputError(input: HTMLInputElement, message: string): void {
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
function ctPromptForGroupName(): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = ctCreateGroupNameModal();
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
        ctShowInputError(input, "グループ名を入力してください");
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
function ctCreateGroupNameModal(): HTMLElement {
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

  ctAddModalStyles(modal);
  return modal;
}

/**
 * モーダルダイアログにスタイルを追加します
 * @param {HTMLElement} modal - スタイルを追加するモーダル要素
 */
function ctAddModalStyles(modal: HTMLElement): void {
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
async function ctCreateCalendarGroup(): Promise<void> {
  try {
    const selectedCalendars = await ctGetCurrentlySelectedCalendars();

    if (selectedCalendars.length === 0) {
      ctShowNotification(
        "カレンダーが選択されていません。グループを作成するには、少なくとも1つのカレンダーを選択してください。"
      );
      return;
    }

    const groupName = await ctPromptForGroupName();
    if (!groupName) {
      return; // ユーザーがキャンセルした場合
    }

    // 既存グループ名との重複チェック
    const existingGroups = await ctLoadGroups();
    const nameExists = existingGroups.some((group) => group.name === groupName);

    if (nameExists) {
      ctShowNotification(
        "同じ名前のグループが既に存在します。別の名前を選択してください。"
      );
      return;
    }

    // 新しいグループを作成
    const newGroup: CalendarGroup = {
      id: ctGenerateId(),
      name: groupName,
      calendars: selectedCalendars,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await ctAddGroup(newGroup);
    ctShowNotification(
      `グループ "${groupName}" を作成しました。\n含まれるカレンダー: ${selectedCalendars.join(
        ", "
      )}`
    );

    console.log("新しいグループを作成しました:", newGroup);
  } catch (error) {
    console.error("グループ作成中にエラーが発生しました:", error);
    ctShowNotification("グループの作成に失敗しました。");
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
async function ctHandleMessage(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  try {
    switch (message.action) {
      case "applyGroup":
        // グループを適用
        await ctApplyCalendarGroup(
          message.group,
          message.settings.disableOthers
        );
        sendResponse({ success: true });
        break;

      case "createGroup":
        // グループを作成
        await ctCreateCalendarGroup();
        sendResponse({ success: true });
        break;

      case "getCurrentCalendars":
        // 現在選択中のカレンダーを取得
        const calendars = await ctGetCurrentlySelectedCalendars();
        sendResponse({ success: true, calendars });
        break;

      case "getCalendarList":
        // 全カレンダーの一覧を取得
        const allCalendars = await ctGetCalendarCheckboxes();
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
async function ctInitialize(): Promise<void> {
  console.log("Google カレンダーグループ拡張機能が初期化されました");

  try {
    // カレンダーの読み込み完了を待機
    await ctWaitForCalendarLoad();
    console.log("カレンダーの読み込みが完了しました");
  } catch (error) {
    console.error("カレンダーの初期化に失敗しました:", error);
  }

  // メッセージリスナーを設定
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    ctHandleMessage(message, sender, sendResponse);
    return true; // 非同期レスポンスを送信することを示す
  });
}

// ===== デバッグ・テスト関数（グローバル公開） =====

/**
 * ブラウザコンソールから呼び出し可能なテスト関数
 */
(window as any).ctDebugAnalyze = ctAnalyzeDOMStructure;
(window as any).ctDebugScrollTo = ctFindAndScrollToCheckbox;
(window as any).ctDebugToggle = async (label: string) => {
  const checkbox = await ctFindAndScrollToCheckbox(label);
  if (checkbox) {
    ctToggleCheckbox(checkbox, !checkbox.checked);
    console.log(
      `🔄 トグル完了: "${label}" -> ${checkbox.checked ? "ON" : "OFF"}`
    );
  }
};
(window as any).ctDebugDrawer = ctFindDrawerScrollContainer;
(window as any).ctTestScroll = async (distance: number = 200) => {
  const drawer = ctFindDrawerScrollContainer();
  if (drawer) {
    console.log(`📜 テストスクロール開始: ${distance}px`);
    console.log(`現在のスクロール位置: ${drawer.scrollTop}px`);
    drawer.scrollTop += distance;
    await ctSleep(500);
    console.log(`新しいスクロール位置: ${drawer.scrollTop}px`);
    const newCheckboxCount = document.querySelectorAll(
      'input[type="checkbox"]'
    ).length;
    console.log(`スクロール後のチェックボックス数: ${newCheckboxCount}`);
  }
};

// DOM読み込み完了後に初期化を実行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ctInitialize);
} else {
  ctInitialize();
}
