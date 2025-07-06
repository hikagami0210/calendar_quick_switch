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
declare class ContentStorageService {
    private static readonly STORAGE_KEY;
    private static readonly SETTINGS_KEY;
    static saveGroups(groups: CalendarGroup[]): Promise<void>;
    static loadGroups(): Promise<CalendarGroup[]>;
    static saveSettings(settings: {
        disableOthers: boolean;
    }): Promise<void>;
    static loadSettings(): Promise<{
        disableOthers: boolean;
    }>;
    static addGroup(group: CalendarGroup): Promise<void>;
    static generateId(): string;
}
declare class CalendarManager {
    private readonly POSSIBLE_SELECTORS;
    private readonly CALENDAR_CHECKBOX_SELECTOR;
    findOtherCalendarsSection(): Promise<HTMLElement | null>;
    getCalendarCheckboxes(): Promise<CalendarCheckbox[]>;
    private getCalendarLabel;
    applyGroup(group: CalendarGroup, disableOthers?: boolean): Promise<void>;
    getCurrentlySelectedCalendars(): Promise<string[]>;
    private toggleCheckbox;
    private sleep;
    waitForCalendarLoad(): Promise<void>;
}
declare class GroupCreator {
    private calendarManager;
    constructor();
    createGroup(): Promise<void>;
    private promptForGroupName;
    private createModal;
    private addModalStyles;
    private showInputError;
    private showMessage;
}
declare class ContentScript {
    private calendarManager;
    private groupCreator;
    constructor();
    private initialize;
    private setupMessageListener;
    private handleMessage;
    private handleApplyGroup;
    private handleCreateGroup;
}
//# sourceMappingURL=content-standalone.d.ts.map