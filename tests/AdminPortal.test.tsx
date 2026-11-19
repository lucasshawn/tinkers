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

    // Verify updated inventory was persisted to localStorage so reloading /admin retains changes
    const stored = JSON.parse(localStorage.getItem('weebles_products_v1') || 'null');
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.find((p: any) => p.id === 'weeble-bumblebee')).toBeUndefined();
  });

  it('loads persisted inventory from localStorage on mount after stock update', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    localStorage.setItem(
      'weebles_products_v1',
      JSON.stringify([
        {
          id: 'weeble-custom-persisted',
          name: 'Persisted Matcha Bear',
          description: 'Saved in inventory',
          price: 19.5,
          images: ['/images/products/bumblebee-keychain.jpg'],
          category: 'animals',
          availableVariants: ['magnet'],
          inStock: true,
          stockCount: 7,
        },
      ])
    );

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    expect(screen.getByText('Persisted Matcha Bear')).toBeInTheDocument();
    expect(screen.getByText('Stock: 7')).toBeInTheDocument();
    expect(screen.queryByText('Chubby Bumblebee')).not.toBeInTheDocument();
  });

  it('keeps error message visible until dismissed and preserves local catalog updates if backend save fails', async () => {
    vi.useFakeTimers();
    try {
      adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
      vi.spyOn(adminApi, 'saveInventory').mockRejectedValue(new Error('Backend Error: Payload Too Large (413)'));
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <SettingsProvider>
          <AdminPortal />
        </SettingsProvider>
      );

      const deleteBtns = screen.getAllByRole('button', { name: /Delete/i });
      fireEvent.click(deleteBtns[0]);

      await vi.waitFor(() => {
        expect(screen.getByText(/Backend Error: Payload Too Large \(413\)/i)).toBeInTheDocument();
      });

      // Advance 10 seconds - error must NOT auto-disappear
      vi.advanceTimersByTime(10000);
      expect(screen.getByText(/Backend Error: Payload Too Large \(413\)/i)).toBeInTheDocument();

      // Dismiss button clears the error
      const dismissBtn = screen.getByRole('button', { name: /Dismiss error/i });
      fireEvent.click(dismissBtn);
      expect(screen.queryByText(/Backend Error: Payload Too Large \(413\)/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  it('logs changes line-by-line in the Changes tab when edits are saved', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveAdmins').mockResolvedValue({
      success: true,
      message: 'Admin whitelist saved successfully!',
    });
    vi.spyOn(adminApi, 'saveChanges').mockResolvedValue({
      success: true,
      message: 'Change log saved.',
    });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Add a new admin
    fireEvent.click(screen.getByRole('button', { name: /Manage Admins/i }));
    fireEvent.change(screen.getByPlaceholderText(/friend@gmail.com/i), {
      target: { value: 'logger@weebles.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Admin/i }));

    await waitFor(() => {
      expect(adminApi.saveAdmins).toHaveBeenCalled();
    });

    // Switch to Changes tab and verify log row
    fireEvent.click(screen.getByRole('button', { name: /Changes/i }));
    expect(screen.getByText('Admin Whitelist - Added Admin')).toBeInTheDocument();
    expect(screen.getByText('logger@weebles.com')).toBeInTheDocument();
  });

  it('logs errors in the Changes tab when an admin action or save fails', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveInventory').mockRejectedValue(new Error('GitHub API 500 error'));
    vi.spyOn(adminApi, 'saveChanges').mockResolvedValue({
      success: true,
      message: 'Change log saved.',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Trigger failed inventory delete
    const deleteBtns = screen.getAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/GitHub API 500 error/i)).toBeInTheDocument();
    });

    // Also trigger an admin email validation error
    fireEvent.click(screen.getByRole('button', { name: /Manage Admins/i }));
    fireEvent.change(screen.getByPlaceholderText(/friend@gmail.com/i), {
      target: { value: 'invalid-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Admin/i }));

    // Open Changes tab and verify both errors are logged
    fireEvent.click(screen.getByRole('button', { name: /Changes/i }));
    expect(screen.getByText('Error: Save Inventory')).toBeInTheDocument();
    expect(screen.getByText('ERROR: GitHub API 500 error')).toBeInTheDocument();
    expect(screen.getByText('Error: Add Admin')).toBeInTheDocument();
    expect(screen.getByText(/ERROR: Please enter a valid email address/i)).toBeInTheDocument();
  });
});
