import { CalendarGroup } from './types';

export class StorageService {
  private static readonly STORAGE_KEY = 'calendarGroups';
  private static readonly SETTINGS_KEY = 'settings';

  static async saveGroups(groups: CalendarGroup[]): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: groups
      });
    } catch (error) {
      console.error('Failed to save groups:', error);
      throw error;
    }
  }

  static async loadGroups(): Promise<CalendarGroup[]> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error('Failed to load groups:', error);
      return [];
    }
  }

  static async saveSettings(settings: { disableOthers: boolean }): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.SETTINGS_KEY]: settings
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  static async loadSettings(): Promise<{ disableOthers: boolean }> {
    try {
      const result = await chrome.storage.local.get(this.SETTINGS_KEY);
      return result[this.SETTINGS_KEY] || { disableOthers: true };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { disableOthers: true };
    }
  }

  static async addGroup(group: CalendarGroup): Promise<void> {
    const groups = await this.loadGroups();
    groups.push(group);
    await this.saveGroups(groups);
  }

  static async updateGroup(groupId: string, updates: Partial<CalendarGroup>): Promise<void> {
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

  static async deleteGroup(groupId: string): Promise<void> {
    const groups = await this.loadGroups();
    const filteredGroups = groups.filter(g => g.id !== groupId);
    await this.saveGroups(filteredGroups);
  }

  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}