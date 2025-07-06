"use strict";
class StorageService {
    static async saveGroups(groups) {
        try {
            await chrome.storage.local.set({
                [this.STORAGE_KEY]: groups
            });
        }
        catch (error) {
            console.error('Failed to save groups:', error);
            throw error;
        }
    }
    static async loadGroups() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            return result[this.STORAGE_KEY] || [];
        }
        catch (error) {
            console.error('Failed to load groups:', error);
            return [];
        }
    }
    static async saveSettings(settings) {
        try {
            await chrome.storage.local.set({
                [this.SETTINGS_KEY]: settings
            });
        }
        catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    }
    static async loadSettings() {
        try {
            const result = await chrome.storage.local.get(this.SETTINGS_KEY);
            return result[this.SETTINGS_KEY] || { disableOthers: true };
        }
        catch (error) {
            console.error('Failed to load settings:', error);
            return { disableOthers: true };
        }
    }
    static async addGroup(group) {
        const groups = await this.loadGroups();
        groups.push(group);
        await this.saveGroups(groups);
    }
    static async updateGroup(groupId, updates) {
        const groups = await this.loadGroups();
        const groupIndex = groups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) {
            throw new Error(`Group with ID ${groupId} not found`);
        }
        groups[groupIndex] = {
            ...groups[groupIndex],
            ...updates,
            updatedAt: Date.now()
        };
        await this.saveGroups(groups);
    }
    static async deleteGroup(groupId) {
        const groups = await this.loadGroups();
        const filteredGroups = groups.filter(g => g.id !== groupId);
        await this.saveGroups(filteredGroups);
    }
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
StorageService.STORAGE_KEY = 'calendarGroups';
StorageService.SETTINGS_KEY = 'settings';
class BackgroundService {
    constructor() {
        this.MENU_ID_PREFIX = 'calendar-group-';
        this.CREATE_GROUP_MENU_ID = 'create-group';
        this.SEPARATOR_ID = 'separator';
        this.initializeContextMenus();
        this.setupEventListeners();
    }
    async initializeContextMenus() {
        await this.updateContextMenus();
    }
    setupEventListeners() {
        chrome.contextMenus.onClicked.addListener(this.handleContextMenuClick.bind(this));
        chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));
    }
    async updateContextMenus() {
        chrome.contextMenus.removeAll(async () => {
            const groups = await StorageService.loadGroups();
            if (groups.length > 0) {
                groups.forEach(group => {
                    chrome.contextMenus.create({
                        id: this.MENU_ID_PREFIX + group.id,
                        title: `グループ: ${group.name}`,
                        contexts: ['page'],
                        documentUrlPatterns: ['https://calendar.google.com/*']
                    });
                });
                chrome.contextMenus.create({
                    id: this.SEPARATOR_ID,
                    type: 'separator',
                    contexts: ['page'],
                    documentUrlPatterns: ['https://calendar.google.com/*']
                });
            }
            chrome.contextMenus.create({
                id: this.CREATE_GROUP_MENU_ID,
                title: 'グループを作成',
                contexts: ['page'],
                documentUrlPatterns: ['https://calendar.google.com/*']
            });
        });
    }
    async handleContextMenuClick(info, tab) {
        if (!tab?.id)
            return;
        const menuItemId = info.menuItemId;
        try {
            if (menuItemId === this.CREATE_GROUP_MENU_ID) {
                await this.handleCreateGroup(tab.id);
            }
            else if (menuItemId.startsWith(this.MENU_ID_PREFIX)) {
                const groupId = menuItemId.replace(this.MENU_ID_PREFIX, '');
                await this.handleGroupSelection(tab.id, groupId);
            }
        }
        catch (error) {
            console.error('Error handling context menu click:', error);
        }
    }
    async handleCreateGroup(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'createGroup'
            });
            if (response && response.success) {
                console.log('Group creation initiated');
            }
        }
        catch (error) {
            console.error('Failed to initiate group creation:', error);
        }
    }
    async handleGroupSelection(tabId, groupId) {
        try {
            const groups = await StorageService.loadGroups();
            const selectedGroup = groups.find(g => g.id === groupId);
            if (!selectedGroup) {
                console.error('Group not found:', groupId);
                return;
            }
            const settings = await StorageService.loadSettings();
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'applyGroup',
                group: selectedGroup,
                settings: settings
            });
            if (response && response.success) {
                console.log('Group applied successfully:', selectedGroup.name);
            }
        }
        catch (error) {
            console.error('Failed to apply group:', error);
        }
    }
    async handleStorageChange(changes, namespace) {
        if (namespace === 'local' && changes.calendarGroups) {
            await this.updateContextMenus();
        }
    }
}
new BackgroundService();
//# sourceMappingURL=background-standalone.js.map