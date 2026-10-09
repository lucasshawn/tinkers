import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminsTab } from '../src/components/admin/AdminsTab';

describe('AdminsTab', () => {
  const mockAdmins = ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders authorized admins list and marks current session', () => {
    render(
      <AdminsTab
        admins={mockAdmins}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('lucasshawn@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('lucascierra24@gmail.com')).toBeInTheDocument();
    expect(screen.getByText(/Active Session/i)).toBeInTheDocument();
  });

  it('allows adding a new valid admin email', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AdminsTab
        admins={mockAdmins}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={handleSave}
      />
    );

    const input = screen.getByPlaceholderText(/friend@gmail.com/i);
    fireEvent.change(input, { target: { value: 'assistant@weebles.com' } });

    const addBtn = screen.getByRole('button', { name: /Add Admin/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith([
        'lucasshawn@gmail.com',
        'lucascierra24@gmail.com',
        'assistant@weebles.com',
      ]);
    });
  });

  it('validates invalid email format and duplicate email', async () => {
    const handleSave = vi.fn();
    render(
      <AdminsTab
        admins={mockAdmins}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={handleSave}
      />
    );

    const input = screen.getByPlaceholderText(/friend@gmail.com/i);
    const addBtn = screen.getByRole('button', { name: /Add Admin/i });

    // Invalid email
    fireEvent.change(input, { target: { value: 'notanemail' } });
    fireEvent.click(addBtn);
    expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    expect(handleSave).not.toHaveBeenCalled();

    // Duplicate email
    fireEvent.change(input, { target: { value: 'lucasshawn@gmail.com' } });
    fireEvent.click(addBtn);
    await waitFor(() => {
      expect(screen.getByText(/is already an authorized administrator/i)).toBeInTheDocument();
    });
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('prevents removing current active user or having 0 admins', () => {
    render(
      <AdminsTab
        admins={['lucasshawn@gmail.com']}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={vi.fn()}
      />
    );

    // No remove button for self or when count is 1
    expect(screen.queryByRole('button', { name: /Remove Admin/i })).not.toBeInTheDocument();
  });

  it('allows removing another administrator after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(
      <AdminsTab
        admins={mockAdmins}
        currentAdminEmail="lucasshawn@gmail.com"
        onSave={handleSave}
      />
    );

    const removeBtn = screen.getByRole('button', { name: /Remove Admin/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(['lucasshawn@gmail.com']);
    });
  });
});
