import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPortal } from '../src/components/admin/AdminPortal';
import { adminAuth } from '../src/services/adminAuth';
import { adminApi } from '../src/services/adminApi';
import { adminPayments } from '../src/services/adminPayments';
import { SettingsProvider } from '../src/context/SettingsContext';

describe('AdminPortal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(adminPayments, 'fetchPayments').mockResolvedValue({
      connected: false,
      mode: 'demo',
      summary: { totalRevenue: 109, orderCount: 4, averageOrderValue: 27.25 },
      transactions: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login card when not authenticated', () => {
    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login as Shawn/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/lucasshawn@gmail.com/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Return to Storefront/i)).toBeInTheDocument();
  });

  it('renders dashboard with 4 tabs when authenticated', () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    expect(screen.getByText(/Weebles Studio Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/lucasshawn@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Store/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /Log Out/i })).toBeInTheDocument();

    // 4 tabs present
    expect(screen.getByRole('button', { name: /Manage Admins/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage Catalog/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage Payments/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage Site Content/i })).toBeInTheDocument();

    // Default tab is Catalog
    expect(screen.getByRole('button', { name: /\+ Add New Weeble/i })).toBeInTheDocument();
  });

  it('switches between all 4 tabs smoothly', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // 1. Switch to Manage Admins
    fireEvent.click(screen.getByRole('button', { name: /Manage Admins/i }));
    expect(screen.getByRole('button', { name: /Add Admin/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add New Weeble/i })).not.toBeInTheDocument();

    // 2. Switch to Manage Payments
    fireEvent.click(screen.getByRole('button', { name: /Manage Payments/i }));
    await waitFor(() => {
      expect(screen.getByText(/Open Stripe Dashboard/i)).toBeInTheDocument();
    });

    // 3. Switch to Manage Site Content
    fireEvent.click(screen.getByRole('button', { name: /Manage Site Content/i }));
    expect(screen.getByText(/Storefront Announcement Banner/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & Publish Site Content/i })).toBeInTheDocument();

    // 4. Switch back to Manage Catalog
    fireEvent.click(screen.getByRole('button', { name: /Manage Catalog/i }));
    expect(screen.getByRole('button', { name: /\+ Add New Weeble/i })).toBeInTheDocument();
  });

  it('handles saving admin whitelist and displays notification banner', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveAdmins').mockResolvedValue({
      success: true,
      message: 'Admin whitelist saved successfully!',
    });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Navigate to Manage Admins tab
    fireEvent.click(screen.getByRole('button', { name: /Manage Admins/i }));

    const input = screen.getByPlaceholderText(/friend@gmail.com/i);
    fireEvent.change(input, { target: { value: 'newadmin@gmail.com' } });

    const addBtn = screen.getByRole('button', { name: /Add Admin/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(adminApi.saveAdmins).toHaveBeenCalled();
      expect(screen.getByText('Admin whitelist saved successfully!')).toBeInTheDocument();
    });
  });

  it('handles saving site content and displays notification banner', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveSettings').mockResolvedValue({
      success: true,
      message: 'Site content updated successfully!',
    });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Navigate to Manage Site Content tab
    fireEvent.click(screen.getByRole('button', { name: /Manage Site Content/i }));

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Site Content/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminApi.saveSettings).toHaveBeenCalled();
      expect(screen.getByText('Site content updated successfully!')).toBeInTheDocument();
    });
  });

  it('handles saving inventory and displays notification banner', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveInventory').mockResolvedValue({
      success: true,
      message: 'Inventory saved and published to GitHub!',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Delete first item
    const deleteBtns = screen.getAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(adminApi.saveInventory).toHaveBeenCalled();
      expect(screen.getByText('Inventory saved and published to GitHub!')).toBeInTheDocument();
    });
  });

  it('allows logging out and returns to login card', () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucascierra24@gmail.com', name: 'Cierra' });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    const logoutBtn = screen.getByRole('button', { name: /Log Out/i });
    fireEvent.click(logoutBtn);

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
    expect(screen.queryByText(/Weebles Studio Admin/i)).not.toBeInTheDocument();
    expect(adminAuth.getSession()).toBeNull();
  });
});
