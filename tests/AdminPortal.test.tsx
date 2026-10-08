import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPortal } from '../src/components/admin/AdminPortal';
import { adminAuth } from '../src/services/adminAuth';
import { adminApi } from '../src/services/adminApi';
import { SettingsProvider } from '../src/context/SettingsContext';

describe('AdminPortal', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
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
    expect(screen.getByRole('button', { name: /Login as Shawn/i })).toBeInTheDocument();
    expect(screen.queryByText(/lucasshawn@gmail.com/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Return to Storefront/i)).toBeInTheDocument();
  });

  it('renders dashboard with tabs when authenticated', () => {
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
    expect(screen.getByRole('button', { name: /Inventory Catalog/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Store & Social Settings/i })).toBeInTheDocument();
    // Default tab is Inventory
    expect(screen.getByRole('button', { name: /\+ Add New Weeble/i })).toBeInTheDocument();
  });

  it('switches between Inventory and Settings tabs', () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Click Settings tab
    const settingsTabBtn = screen.getByRole('button', { name: /Store & Social Settings/i });
    fireEvent.click(settingsTabBtn);

    expect(screen.getByText(/Studio Emails/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save & Publish Settings/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Add New Weeble/i })).not.toBeInTheDocument();

    // Click Inventory tab back
    const inventoryTabBtn = screen.getByRole('button', { name: /Inventory Catalog/i });
    fireEvent.click(inventoryTabBtn);

    expect(screen.getByRole('button', { name: /\+ Add New Weeble/i })).toBeInTheDocument();
  });

  it('handles saving settings and displays notification banner', async () => {
    adminAuth.setSession({ token: 'valid-token', email: 'lucasshawn@gmail.com', name: 'Shawn' });
    vi.spyOn(adminApi, 'saveSettings').mockResolvedValue({
      success: true,
      message: 'Settings updated successfully!',
    });

    render(
      <SettingsProvider>
        <AdminPortal />
      </SettingsProvider>
    );

    // Navigate to settings tab
    const settingsTabBtn = screen.getByRole('button', { name: /Store & Social Settings/i });
    fireEvent.click(settingsTabBtn);

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(adminApi.saveSettings).toHaveBeenCalled();
      expect(screen.getByText('Settings updated successfully!')).toBeInTheDocument();
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
