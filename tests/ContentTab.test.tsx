import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentTab } from '../src/components/admin/ContentTab';
import { SiteSettings } from '../src/types/settings';

const mockSettings: SiteSettings = {
  contactEmail: 'weeblesclay@gmail.com',
  customOrderEmail: 'customorders@weeblesclay.com',
  socials: {
    tiktok: 'https://tiktok.com/@weebles_clay',
    instagram: 'https://instagram.com/weebles_clay',
    facebookMarketplace: 'https://facebook.com/marketplace',
  },
  announcementBanner: {
    enabled: true,
    text: '🌸 Spring Collection is dropping this Saturday!',
  },
  admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'],
};

describe('ContentTab', () => {
  it('renders pre-filled fields for banner, emails, and socials', () => {
    render(<ContentTab settings={mockSettings} onSave={vi.fn()} />);

    expect(screen.getByDisplayValue('🌸 Spring Collection is dropping this Saturday!')).toBeInTheDocument();
    expect(screen.getByDisplayValue('weeblesclay@gmail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('customorders@weeblesclay.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://tiktok.com/@weebles_clay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://instagram.com/weebles_clay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://facebook.com/marketplace')).toBeInTheDocument();

    const bannerToggle = screen.getByRole('checkbox', { name: /Enable Announcement Banner/i });
    expect(bannerToggle).toBeChecked();
  });

  it('allows updating announcement banner and calls onSave with updated settings', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const bannerInput = screen.getByLabelText(/Banner Text/i);
    fireEvent.change(bannerInput, { target: { value: '🍁 Fall Restock is now LIVE!' } });

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Site Content/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementBanner: {
            enabled: true,
            text: '🍁 Fall Restock is now LIVE!',
          },
          contactEmail: 'weeblesclay@gmail.com',
          admins: ['lucasshawn@gmail.com', 'lucascierra24@gmail.com'],
        })
      );
    });
  });

  it('allows toggling announcement banner off', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const bannerToggle = screen.getByRole('checkbox', { name: /Enable Announcement Banner/i });
    fireEvent.click(bannerToggle);
    expect(bannerToggle).not.toBeChecked();

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Site Content/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          announcementBanner: {
            enabled: false,
            text: '🌸 Spring Collection is dropping this Saturday!',
          },
        })
      );
    });
  });

  it('shows success message after successful save', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Site Content/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Site content saved successfully and published!/i)).toBeInTheDocument();
    });
  });
});
