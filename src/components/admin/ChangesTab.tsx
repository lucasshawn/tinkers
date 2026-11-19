import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, History, AlertCircle } from 'lucide-react';
import { ChangeLogEntry } from '../../types';
import { formatLocalTimestamp } from '../../utils/changeLogUtils';

export interface ChangesTabProps {
  changes: ChangeLogEntry[];
}

type SortField = 'timestamp' | 'user' | 'change' | 'comment';
type SortDirection = 'asc' | 'desc';

export const ChangesTab: React.FC<ChangesTabProps> = ({ changes }) => {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const sortedChanges = useMemo(() => {
    const copy = [...changes];
    copy.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'timestamp') {
        const tA = Date.parse(a.timestamp) || 0;
        const tB = Date.parse(b.timestamp) || 0;
        comparison = tA - tB;
      } else {
        const valA = String(a[sortField] ?? '');
        const valB = String(b[sortField] ?? '');
        comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return copy;
  }, [changes, sortField, sortDirection]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-weeble-pink" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-weeble-pink" />
    );
  };

  const getAriaSort = (field: SortField): 'ascending' | 'descending' | 'none' => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const columns: Array<{ field: SortField; label: string }> = [
    { field: 'timestamp', label: 'Time' },
    { field: 'user', label: 'User' },
    { field: 'change', label: 'Change' },
    { field: 'comment', label: 'Comment' },
  ];

  return (
    <div className="bg-white rounded-3xl border-2 border-pink-200 overflow-hidden shadow-sm">
      <div className="p-5 sm:p-6 border-b border-pink-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-weeble-pink">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bubble text-lg font-bold text-weeble-text">Changes & Error Log</h2>
            <p className="text-xs text-weeble-textMuted">
              Line-by-line history of all admin changes and errors in local time (retained for 30 days)
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-weeble-textMuted">
          {changes.length} {changes.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {sortedChanges.length === 0 ? (
        <div className="p-10 text-center text-weeble-textMuted text-sm">
          No changes recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-pink-100 bg-pink-50/50 text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                {columns.map((col) => (
                  <th
                    key={col.field}
                    aria-sort={getAriaSort(col.field)}
                    className="py-3 px-4 whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.field)}
                      aria-label={`Sort by ${col.label}`}
                      className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-weeble-pink transition-colors cursor-pointer"
                    >
                      <span>{col.label}</span>
                      {renderSortIcon(col.field)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-100 text-xs">
              {sortedChanges.map((entry) => {
                const isError =
                  entry.change.startsWith('Error:') || entry.comment.startsWith('ERROR:');
                return (
                  <tr
                    key={entry.id}
                    data-testid="change-log-row"
                    className={
                      isError
                        ? 'bg-rose-50/60 hover:bg-rose-50 transition-colors'
                        : 'hover:bg-weeble-pinkWash/30 transition-colors'
                    }
                  >
                    <td className="py-3 px-4 text-neutral-600 whitespace-nowrap font-mono text-[11px]">
                      {formatLocalTimestamp(entry.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-weeble-text whitespace-nowrap">
                      {entry.user}
                    </td>
                    <td className="py-3 px-4 font-semibold whitespace-nowrap">
                      {isError ? (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{entry.change}</span>
                        </span>
                      ) : (
                        <span className="text-weeble-text">{entry.change}</span>
                      )}
                    </td>
                    <td
                      className={`py-3 px-4 break-words max-w-xl font-medium ${
                        isError ? 'text-rose-700 font-bold font-mono text-[11px]' : 'text-neutral-700'
                      }`}
                    >
                      {entry.comment}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
