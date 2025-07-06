import { CalendarGroup, CalendarCheckbox } from './types';

export class CalendarManager {
  private readonly OTHER_CALENDARS_SELECTOR = '[aria-label="他のカレンダー"]';
  private readonly CALENDAR_CHECKBOX_SELECTOR = 'input[type="checkbox"]';
  private readonly CALENDAR_LABEL_SELECTOR = 'label';

  async findOtherCalendarsSection(): Promise<HTMLElement | null> {
    const maxRetries = 10;
    const retryDelay = 500;

    for (let i = 0; i < maxRetries; i++) {
      const section = document.querySelector(this.OTHER_CALENDARS_SELECTOR) as HTMLElement;
      if (section) {
        return section;
      }
      await this.sleep(retryDelay);
    }

    console.warn('他のカレンダーセクションが見つかりませんでした');
    return null;
  }

  async getCalendarCheckboxes(): Promise<CalendarCheckbox[]> {
    const section = await this.findOtherCalendarsSection();
    if (!section) {
      return [];
    }

    const checkboxes = Array.from(section.querySelectorAll(this.CALENDAR_CHECKBOX_SELECTOR)) as HTMLInputElement[];
    const calendarCheckboxes: CalendarCheckbox[] = [];

    for (const checkbox of checkboxes) {
      const label = this.getCalendarLabel(checkbox);
      if (label) {
        calendarCheckboxes.push({
          element: checkbox,
          label: label,
          checked: checkbox.checked
        });
      }
    }

    return calendarCheckboxes;
  }

  private getCalendarLabel(checkbox: HTMLInputElement): string | null {
    const container = checkbox.closest('div');
    if (!container) return null;

    const label = container.querySelector(this.CALENDAR_LABEL_SELECTOR);
    if (!label) return null;

    const ariaLabel = label.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel;
    }

    return label.textContent?.trim() || null;
  }

  async applyGroup(group: CalendarGroup, disableOthers: boolean = true): Promise<void> {
    const checkboxes = await this.getCalendarCheckboxes();
    
    if (checkboxes.length === 0) {
      console.warn('チェックボックスが見つかりませんでした');
      return;
    }

    console.log(`グループ "${group.name}" を適用中...`);
    console.log('対象カレンダー:', group.calendars);
    
    for (const checkbox of checkboxes) {
      const shouldBeChecked = group.calendars.includes(checkbox.label);
      
      if (shouldBeChecked && !checkbox.checked) {
        this.toggleCheckbox(checkbox.element, true);
        console.log(`カレンダー "${checkbox.label}" を有効にしました`);
      } else if (!shouldBeChecked && checkbox.checked && disableOthers) {
        this.toggleCheckbox(checkbox.element, false);
        console.log(`カレンダー "${checkbox.label}" を無効にしました`);
      }
    }
  }

  async getCurrentlySelectedCalendars(): Promise<string[]> {
    const checkboxes = await this.getCalendarCheckboxes();
    return checkboxes
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.label);
  }

  private toggleCheckbox(checkbox: HTMLInputElement, checked: boolean): void {
    if (checkbox.checked !== checked) {
      checkbox.click();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async waitForCalendarLoad(): Promise<void> {
    const maxWait = 30000;
    const checkInterval = 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const section = await this.findOtherCalendarsSection();
      if (section) {
        const checkboxes = await this.getCalendarCheckboxes();
        if (checkboxes.length > 0) {
          return;
        }
      }
      await this.sleep(checkInterval);
    }

    throw new Error('カレンダーの読み込みがタイムアウトしました');
  }
}