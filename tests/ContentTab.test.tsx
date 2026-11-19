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
  socialLinksEnabled: true,
  socialLinks: [
    {
      id: 'tiktok-1',
      platform: 'tiktok',
      url: 'https://tiktok.com/@weebles_clay',
      enabled: true,
      label: 'TikTok',
      subtitle: '@weebles_clay • ASMR & BTS',
    },
    {
      id: 'insta-1',
      platform: 'instagram',
      url: 'https://instagram.com/weebles_clay',
      enabled: true,
      label: 'Instagram',
      subtitle: '@weebles_clay • Gallery & Drops',
    },
    {
      id: 'fb-1',
      platform: 'facebookMarketplace',
      url: 'https://facebook.com/marketplace',
      enabled: true,
      label: 'Facebook Marketplace',
      subtitle: 'Local Listings & Events',
    },
  ],
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

    expect(screen.getByRole('checkbox', { name: /Enable Announcement Banner/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show Social Media Links on Storefront/i })).toBeChecked();
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

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

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

  it('toggles master social media switch and individual social links off', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    const masterToggle = screen.getByRole('checkbox', { name: /Show Social Media Links on Storefront/i });
    fireEvent.click(masterToggle);
    expect(masterToggle).not.toBeChecked();
    expect(screen.getByText(/currently hidden from the homepage and footer/i)).toBeInTheDocument();

    const tiktokToggle = screen.getByRole('checkbox', { name: /Enable TikTok link/i });
    fireEvent.click(tiktokToggle);
    expect(tiktokToggle).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          socialLinksEnabled: false,
          socialLinks: expect.arrayContaining([
            expect.objectContaining({ id: 'tiktok-1', enabled: false }),
          ]),
        })
      );
    });
  });

  it('adds a new social link, auto-detects X.com platform from URL, edits label/subtitle, reorders, and removes links', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    // Add a new link
    fireEvent.click(screen.getByRole('button', { name: /Add Social Link/i }));

    const urlInputs = screen.getAllByLabelText(/^Profile \/ Link URL$/i);
    expect(urlInputs).toHaveLength(4);

    // Paste X.com URL -> platform select should auto-detect to 'x'
    fireEvent.change(urlInputs[3], { target: { value: 'https://x.com/weebles_clay' } });
    const platformSelects = screen.getAllByLabelText(/^Platform$/i);
    expect((platformSelects[3] as HTMLSelectElement).value).toBe('x');

    // Customize label and subtitle
    const labelInputs = screen.getAllByLabelText(/^Display Label \(optional\)$/i);
    const subtitleInputs = screen.getAllByLabelText(/^Subtitle \/ Handle \(optional\)$/i);
    fireEvent.change(labelInputs[3], { target: { value: 'Weebles on X' } });
    fireEvent.change(subtitleInputs[3], { target: { value: 'Live Restock Alerts' } });

    // Move the new link up one slot (index 3 -> index 2)
    const moveUpButtons = screen.getAllByRole('button', { name: /Move link up/i });
    fireEvent.click(moveUpButtons[3]);

    // Remove Facebook Marketplace (now at index 3)
    fireEvent.click(screen.getByRole('button', { name: /Remove Facebook Marketplace link/i }));

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedSettings: SiteSettings = handleSave.mock.calls[0][0];
    expect(savedSettings.socialLinks).toHaveLength(3);
    expect(savedSettings.socialLinks![2]).toMatchObject({
      platform: 'x',
      url: 'https://x.com/weebles_clay',
      enabled: true,
      label: 'Weebles on X',
      subtitle: 'Live Restock Alerts',
    });
  });

  it('blocks saving when an enabled social link has an invalid or empty URL, but allows saving an empty disabled link', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    // Add an empty enabled link and try to submit
    fireEvent.click(screen.getByRole('button', { name: /Add Social Link/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid http\(s\) URL/i);
    expect(handleSave).not.toHaveBeenCalled();

    // Disable that incomplete draft link -> saving should now succeed
    const newLinkToggle = screen.getByRole('checkbox', { name: /Enable Website link/i });
    fireEvent.click(newLinkToggle);
    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });
  });

  it('shows success message after successful save', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<ContentTab settings={mockSettings} onSave={handleSave} />);

    fireEvent.click(screen.getByRole('button', { name: /Save & Publish Site Content/i }));

    await waitFor(() => {
      expect(screen.getByText(/Site content saved successfully and published!/i)).toBeInTheDocument();
    });
  });
});
