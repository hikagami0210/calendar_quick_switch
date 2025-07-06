export interface CalendarGroup {
  id: string;
  name: string;
  calendars: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CalendarGroupSettings {
  groups: CalendarGroup[];
  disableOthers: boolean;
}

export interface CalendarCheckbox {
  element: HTMLInputElement;
  label: string;
  checked: boolean;
}

export interface ContextMenuClickData {
  menuItemId: string;
  pageUrl?: string;
}

export interface StorageData {
  calendarGroups: CalendarGroup[];
  settings: {
    disableOthers: boolean;
  };
}