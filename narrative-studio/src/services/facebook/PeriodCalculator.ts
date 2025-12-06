/**
 * PeriodCalculator - Calculate time periods for organizing Facebook content
 *
 * Supports:
 * - Birthday-based quarters (90 days starting from user's birthday)
 * - New Year-based quarters (standard Jan 1 start)
 * - Custom period lengths (100 days, etc.)
 * - Flexible folder naming
 */

export interface ArchiveOrganizationSettings {
  // Period configuration
  periodType: 'quarters' | 'fixed-days' | 'months' | 'years';
  periodLength: number;           // Days (90 for quarters, 100 for custom, 365 for years)

  // Year start configuration
  yearStartType: 'birthday' | 'new-year' | 'custom-date';
  birthday?: string;              // 'MM-DD' format (e.g., '04-21')
  customStartDate?: string;       // 'MM-DD' format

  // Folder naming
  useQuarterNames: boolean;       // Q1, Q2 vs P001, P002
  includeDateRanges: boolean;     // Show dates in folder name
}

export interface Period {
  index: number;                  // 0-based period index (0, 1, 2, ...)
  label: string;                  // "Q1" or "P001"
  startDate: Date;                // Period start
  endDate: Date;                  // Period end
  folderName: string;             // "Q1_2008-04-21_to_2008-07-19" or just "Q1_2008"
  year: number;                   // Birthday-based year
}

export const DEFAULT_SETTINGS: ArchiveOrganizationSettings = {
  periodType: 'quarters',
  periodLength: 90,
  yearStartType: 'birthday',
  birthday: '04-21',              // Default to Tem's birthday
  useQuarterNames: true,
  includeDateRanges: true
};

export class PeriodCalculator {
  private settings: ArchiveOrganizationSettings;

  constructor(settings?: Partial<ArchiveOrganizationSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };

    // Validate settings
    if (this.settings.yearStartType === 'birthday' && !this.settings.birthday) {
      throw new Error('Birthday is required when yearStartType is "birthday"');
    }
    if (this.settings.yearStartType === 'custom-date' && !this.settings.customStartDate) {
      throw new Error('customStartDate is required when yearStartType is "custom-date"');
    }
  }

  /**
   * Get the period for a given timestamp
   */
  getPeriodForDate(timestamp: number): Period {
    const date = new Date(timestamp * 1000);
    return this.getPeriodForDateObject(date);
  }

  /**
   * Get the period for a given Date object
   */
  getPeriodForDateObject(date: Date): Period {
    // Get the birthday-based year for this date
    const year = this.getBirthdayYear(date);

    // Get the anchor date for this year (when the year starts)
    const anchorDate = this.getAnchorDate(year);

    // Calculate how many days since the anchor
    const daysSinceAnchor = Math.floor((date.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate period index (0, 1, 2, 3 for quarters)
    const periodIndex = Math.floor(daysSinceAnchor / this.settings.periodLength);

    // Calculate period start and end dates
    const periodStart = new Date(anchorDate);
    periodStart.setDate(periodStart.getDate() + (periodIndex * this.settings.periodLength));

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + this.settings.periodLength - 1);

    // Generate label
    const label = this.generatePeriodLabel(periodIndex, year);

    // Generate folder name
    const folderName = this.generateFolderName(label, periodStart, periodEnd);

    return {
      index: periodIndex,
      label,
      startDate: periodStart,
      endDate: periodEnd,
      folderName,
      year
    };
  }

  /**
   * Get the "birthday year" for a given date
   * If birthday is Apr 21, then:
   * - Apr 21, 2008 = year 2008
   * - Apr 20, 2008 = year 2007
   * - Apr 22, 2008 = year 2008
   */
  private getBirthdayYear(date: Date): number {
    const anchorDate = this.getAnchorDateString();
    const [anchorMonth, anchorDay] = anchorDate.split('-').map(Number);

    const year = date.getFullYear();
    const month = date.getMonth() + 1;  // 0-indexed to 1-indexed
    const day = date.getDate();

    // If we're before the anchor date in the calendar year, we're in the previous birthday year
    if (month < anchorMonth || (month === anchorMonth && day < anchorDay)) {
      return year - 1;
    }

    return year;
  }

  /**
   * Get the anchor date (year start) for a given birthday year
   * For birthday year 2008 with birthday Apr 21, returns Apr 21, 2008
   */
  private getAnchorDate(birthdayYear: number): Date {
    const anchorDateString = this.getAnchorDateString();
    const [month, day] = anchorDateString.split('-').map(Number);
    return new Date(birthdayYear, month - 1, day);  // month is 0-indexed
  }

  /**
   * Get the anchor date string (MM-DD)
   */
  private getAnchorDateString(): string {
    if (this.settings.yearStartType === 'birthday') {
      return this.settings.birthday!;
    } else if (this.settings.yearStartType === 'custom-date') {
      return this.settings.customStartDate!;
    } else {
      return '01-01';  // New Year
    }
  }

  /**
   * Generate period label (Q1, Q2, Q3, Q4 or P001, P002, etc.)
   */
  private generatePeriodLabel(periodIndex: number, year: number): string {
    if (this.settings.useQuarterNames && this.settings.periodType === 'quarters') {
      // Q1, Q2, Q3, Q4
      const quarterNum = (periodIndex % 4) + 1;
      return `Q${quarterNum}`;
    } else {
      // P001, P002, P003, etc.
      return `P${String(periodIndex + 1).padStart(3, '0')}`;
    }
  }

  /**
   * Generate folder name
   * Examples:
   * - Q1_2008-04-21_to_2008-07-19
   * - Q1_2008
   * - P001_2008-04-21_to_2008-07-19
   */
  private generateFolderName(label: string, startDate: Date, endDate: Date): string {
    const year = startDate.getFullYear();

    if (this.settings.includeDateRanges) {
      const startStr = this.formatDate(startDate);
      const endStr = this.formatDate(endDate);
      return `${label}_${startStr}_to_${endStr}`;
    } else {
      return `${label}_${year}`;
    }
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get all periods that fall within a date range
   * Useful for organizing bulk imports
   */
  getPeriodsInRange(startTimestamp: number, endTimestamp: number): Period[] {
    const periods: Period[] = [];
    const startDate = new Date(startTimestamp * 1000);
    const endDate = new Date(endTimestamp * 1000);

    // Start from the first period
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const period = this.getPeriodForDateObject(currentDate);

      // Check if we already have this period (avoid duplicates)
      if (!periods.find(p => p.folderName === period.folderName)) {
        periods.push(period);
      }

      // Move to the next period
      currentDate = new Date(period.endDate);
      currentDate.setDate(currentDate.getDate() + 1);  // Move to first day of next period
    }

    return periods;
  }

  /**
   * Get settings as JSON (for storage)
   */
  getSettings(): ArchiveOrganizationSettings {
    return { ...this.settings };
  }
}
