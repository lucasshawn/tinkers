import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ChangesTab } from '../src/components/admin/ChangesTab';
import { ChangeLogEntry } from '../src/types';

const sampleEntries: ChangeLogEntry[] = [
  {
    id: 'chg-1',
    timestamp: '2026-11-18T10:00:00.000Z',
    who: 'zoe@weebles.com',
    what: "Weeble 'Ghost' - Price",
    oldValue: '$12.00',
    newValue: '$15.00',
  },
  {
    id: 'chg-2',
    timestamp: '2026-11-18T14:30:00.000Z',
    who: 'alice@weebles.com',
    what: 'Added Weeble: Berry Macaron',
    oldValue: '(none)',
    newValue: 'Price: $18.00',
  },
  {
    id: 'chg-3',
    timestamp: '2026-11-18T12:15:00.000Z',
    who: 'bob@weebles.com',
    what: 'Error: Save Inventory',
    oldValue: 'Delete Weeble: Ghost',
    newValue: 'ERROR: Network timeout',
  },
];

describe('ChangesTab', () => {
  it('renders empty state when there are no change entries', () => {
    render(<ChangesTab changes={[]} />);
    expect(screen.getByText(/No changes recorded yet/i)).toBeInTheDocument();
  });

  it('renders line-by-line rows sorted by When descending by default with local time', () => {
    render(<ChangesTab changes={sampleEntries} />);

    const rows = screen.getAllByTestId('change-log-row');
    expect(rows).toHaveLength(3);

    // Default sort is When descending: chg-2 (14:30) -> chg-3 (12:15) -> chg-1 (10:00)
    expect(within(rows[0]).getByText('alice@weebles.com')).toBeInTheDocument();
    expect(within(rows[1]).getByText('bob@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('zoe@weebles.com')).toBeInTheDocument();
  });

  it('allows sorting by each column (When, Who, What, Old, New) ascending and descending', () => {
    render(<ChangesTab changes={sampleEntries} />);

    // 1. Toggle When to ascending -> chg-1 (10:00), chg-3 (12:15), chg-2 (14:30)
    fireEvent.click(screen.getByRole('button', { name: /Sort by When/i }));
    let rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('zoe@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('alice@weebles.com')).toBeInTheDocument();

    // 2. Sort by Who ascending -> alice, bob, zoe
    fireEvent.click(screen.getByRole('button', { name: /Sort by Who/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('alice@weebles.com')).toBeInTheDocument();
    expect(within(rows[1]).getByText('bob@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('zoe@weebles.com')).toBeInTheDocument();

    // Toggle Who descending -> zoe, bob, alice
    fireEvent.click(screen.getByRole('button', { name: /Sort by Who/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('zoe@weebles.com')).toBeInTheDocument();
    expect(within(rows[2]).getByText('alice@weebles.com')).toBeInTheDocument();

    // 3. Sort by What ascending -> "Added Weeble...", "Error: Save Inventory", "Weeble 'Ghost' - Price"
    fireEvent.click(screen.getByRole('button', { name: /Sort by What/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('Added Weeble: Berry Macaron')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Error: Save Inventory')).toBeInTheDocument();
    expect(within(rows[2]).getByText("Weeble 'Ghost' - Price")).toBeInTheDocument();

    // 4. Sort by Old ascending -> "(none)", "$12.00", "Delete Weeble: Ghost"
    fireEvent.click(screen.getByRole('button', { name: /Sort by Old/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('(none)')).toBeInTheDocument();
    expect(within(rows[1]).getByText('$12.00')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Delete Weeble: Ghost')).toBeInTheDocument();

    // Toggle Old descending -> "Delete Weeble: Ghost", "$12.00", "(none)"
    fireEvent.click(screen.getByRole('button', { name: /Sort by Old/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('Delete Weeble: Ghost')).toBeInTheDocument();
    expect(within(rows[2]).getByText('(none)')).toBeInTheDocument();

    // 5. Sort by New ascending -> "$15.00", "ERROR: Network timeout", "Price: $18.00"
    fireEvent.click(screen.getByRole('button', { name: /Sort by New/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('$15.00')).toBeInTheDocument();
    expect(within(rows[1]).getByText('ERROR: Network timeout')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Price: $18.00')).toBeInTheDocument();

    // Toggle New descending -> "Price: $18.00", "ERROR: Network timeout", "$15.00"
    fireEvent.click(screen.getByRole('button', { name: /Sort by New/i }));
    rows = screen.getAllByTestId('change-log-row');
    expect(within(rows[0]).getByText('Price: $18.00')).toBeInTheDocument();
    expect(within(rows[2]).getByText('$15.00')).toBeInTheDocument();
  });
});
