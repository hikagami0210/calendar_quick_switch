interface CalendarGroup {
    id: string;
    name: string;
    calendars: string[];
    createdAt: number;
    updatedAt: number;
}
declare class StorageService {
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
    static updateGroup(groupId: string, updates: Partial<CalendarGroup>): Promise<void>;
    static deleteGroup(groupId: string): Promise<void>;
    static generateId(): string;
}
declare class BackgroundService {
    private readonly MENU_ID_PREFIX;
    private readonly CREATE_GROUP_MENU_ID;
    private readonly SEPARATOR_ID;
    constructor();
    private initializeContextMenus;
    private setupEventListeners;
    private updateContextMenus;
    private handleContextMenuClick;
    private handleCreateGroup;
    private handleGroupSelection;
    private handleStorageChange;
}
//# sourceMappingURL=background-standalone.d.ts.map