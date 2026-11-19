export interface ChangeLogEntry {
  id: string;
  timestamp: string;
  who: string;
  what: string;
  oldValue: string;
  newValue: string;
}
