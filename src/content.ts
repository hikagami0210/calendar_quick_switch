import { CalendarManager } from "./calendar-manager";
import { GroupCreator } from "./group-creator";
import { CalendarGroup } from "./types";

class ContentScript {
  private calendarManager: CalendarManager;
  private groupCreator: GroupCreator;

  constructor() {
    this.calendarManager = new CalendarManager();
    this.groupCreator = new GroupCreator();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    console.log("Google カレンダーグループ拡張機能が初期化されました");

    try {
      await this.calendarManager.waitForCalendarLoad();
      console.log("カレンダーの読み込みが完了しました");
    } catch (error) {
      console.error("カレンダーの初期化に失敗しました:", error);
    }

    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
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
        case "applyGroup":
          await this.handleApplyGroup(message.group, message.settings);
          sendResponse({ success: true });
          break;

        case "createGroup":
          await this.handleCreateGroup();
          sendResponse({ success: true });
          break;

        case "getCurrentCalendars":
          const calendars =
            await this.calendarManager.getCurrentlySelectedCalendars();
          sendResponse({ success: true, calendars });
          break;

        case "getCalendarList":
          const allCalendars =
            await this.calendarManager.getCalendarCheckboxes();
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

  private async handleApplyGroup(
    group: CalendarGroup,
    settings: { disableOthers: boolean }
  ): Promise<void> {
    console.log(`グループ "${group.name}" を適用しています...`);

    await this.calendarManager.applyGroup(group, settings.disableOthers);

    console.log(`グループ "${group.name}" の適用が完了しました`);
  }

  private async handleCreateGroup(): Promise<void> {
    console.log("新しいグループの作成を開始します...");

    await this.groupCreator.createGroup();

    console.log("グループ作成処理が完了しました");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new ContentScript();
  });
} else {
  new ContentScript();
}
