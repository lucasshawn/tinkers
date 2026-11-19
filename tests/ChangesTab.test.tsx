import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ChangesTab } from '../src/components/admin/ChangesTab';
import { ChangeLogEntry } from '../src/types';

const sampleEntries: ChangeLogEntry[] = [
  {
    id: 'chg-1',
    timestamp: '2026-11-18T10:00:00.000Z',
    user: 'zoe@weebles.com',
    change: "Weeble 'Ghost' - Price",
    comment: 'Old: $12.00 -> New: $15.00',
  },
  {
    id: 'chg-2',
    timestamp: '2026-11-18T14:30:00.000Z',
    user: 'alice@weebles.com',
    change: 'Added Weeble: Berry Macaron',
    comment: 'New: Price: $18.00',
  },
  {
    id: 'chg-3',
    timestamp: '2026-11-18T12:15:00.000Z',
    user: 'bob@weebles.com',
    change: 'Error: Save Inventory',
    comment: 'ERROR: Network timeout | Context: Delete Weeble: Ghost',
  },
];

describe('ChangesTab', () => {
  it('renders empty state when there are no change entries', () => {
    render(<ChangesTab changes={[]} />);
    expect(screen.getByText(/No changes recorded yet/i)).toBeInTheDocument();
  });

  it('renders line-by-line rows with Time, User, Change, Comment columns sorted by Time descending by default', () => {
    render(<ChangesTab changes={sampleEntries} />);

    expect(screen.getByRole('button', { name: /Sort by Time/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sort by User/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sort by Change/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sort by Comment/i })).toBeInTheDocument();

    const rows = screen.getAllByTestId('change-log-row');
    expect(rows).toHaveLength(3);

    // Default sort is Time descending: chg-2 (14:30) -> chg-3 (12:15) -> chg-1 (10:00)
    expect(within(rows[0]).getByText('alice@weebles.com')).toBeInTheDocument();
    expect(within(rows[1]).getByText('bob@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('zoe@weebles.com')).toBeInTheDocument();
  });

  it('allows sorting by each column (Time, User, Change, Comment) ascending and descending', () => {
    render(<ChangesTab changes={sampleEntries} />);

    // 1. Toggle Time to ascending -> chg-1 (10:00), chg-3 (12:15), chg-2 (14:30)
    fireEvent.click(screen.getByRole('button', { name: /Sort by Time/i }));
    let rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('zoe@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('alice@weebles.com')).toBeInTheDocument();

    // 2. Sort by User ascending -> alice, bob, zoe
    fireEvent.click(screen.getByRole('button', { name: /Sort by User/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('alice@weebles.com')).toBeInTheDocument();
    expect(within(rows[1]).getByText('bob@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('zoe@weebles.com')).toBeInTheDocument();

    // Toggle User descending -> zoe, bob, alice
    fireEvent.click(screen.getByRole('button', { name: /Sort by User/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('zoe@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('alice@weebles.com')).toBeInTheDocument();

    // 3. Sort by Change ascending -> "Added Weeble...", "Error: Save Inventory", "Weeble 'Ghost' - Price"
    fireEvent.click(screen.getByRole('button', { name: /Sort by Change/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('Added Weeble: Berry Macaron')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Error: Save Inventory')).toBeInTheDocument();
    expect(within(rows[2]).getByText("Weeble 'Ghost' - Price")).toBeInTheDocument();

    // 4. Sort by Comment ascending -> "ERROR: Network timeout...", "New: Price: $18.00", "Old: $12.00 -> New: $15.00"
    fireEvent.click(screen.getByRole('button', { name: /Sort by Comment/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText(/ERROR: Network timeout/i)).toBeInTheDocument();
    expect(within(rows[1]).getByText('New: Price: $18.00')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Old: $12.00 -> New: $15.00')).toBeInTheDocument();

    // Toggle Comment descending -> "Old: $12.00 -> New: $15.00", "New: Price: $18.00", "ERROR: Network timeout..."
    fireEvent.click(screen.getByRole('button', { name: /Sort by Comment/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('Old: $12.00 -> New: $15.00')).toBeInTheDocument();
    expect(within(rows[2]).getByText(/ERROR: Network timeout/i)).toBeInTheDocument();
  });
});
