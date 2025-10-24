export class RecordQueryHelper {
  static toCamel(input: string): string {
    return input.charAt(0).toLowerCase() + input.slice(1);
  }

  static isBoolean(value: any): boolean {
    if (typeof value === 'boolean') return true;
    const s = String(value).toLowerCase();
    return s === 'true' || s === 'false';
  }

  static toBoolean(value: any): boolean {
    return value === true || String(value).toLowerCase() === 'true';
  }

  static isNumeric(value: any): boolean {
    return value !== '' && value != null && !isNaN(Number(value));
  }

  static escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static parseCsv(value: string): string[] {
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
  }
}
