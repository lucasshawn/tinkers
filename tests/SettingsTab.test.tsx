import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsTab } from '../src/components/admin/SettingsTab';
import { SiteSettings } from '../src/types/settings';

const mockSettings: SiteSettings = {
  contactEmail: 'weeblesclay@gmail.com',
  customOrderEmail: 'customorders@weeblesclay.com',
  socials: {
    tiktok: 'https://tiktok.com/@weebles_clay',
    instagram: 'https://instagram.com/weebles_clay',
    facebookMarketplace: 'https://facebook.com/marketplace',
  },
};

describe('SettingsTab', () => {
  it('renders inputs with pre-filled current values', () => {
    render(<SettingsTab settings={mockSettings} onSave={vi.fn()} />);

    expect(screen.getByDisplayValue('weeblesclay@gmail.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('customorders@weeblesclay.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://tiktok.com/@weebles_clay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://instagram.com/weebles_clay')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://facebook.com/marketplace')).toBeInTheDocument();
  });

  it('triggers onSave callback with updated values', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsTab settings={mockSettings} onSave={handleSave} />);

    const contactInput = screen.getByLabelText(/General Contact Email/i);
    fireEvent.change(contactInput, { target: { value: 'cierra@weebles.com' } });

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({ contactEmail: 'cierra@weebles.com' })
      );
    });
  });

  it('shows success message after successful save', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<SettingsTab settings={mockSettings} onSave={handleSave} />);

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Settings/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Settings saved successfully and published!/i)).toBeInTheDocument();
    });
  });

  it('disables save button and displays publishing text while saving', async () => {
    let resolveSave: () => void = () => {};
    const handleSave = vi.fn().mockImplementation(() => new Promise<void>((res) => {
      resolveSave = res;
    }));

    render(<SettingsTab settings={mockSettings} onSave={handleSave} />);

    const saveBtn = screen.getByRole('button', { name: /Save & Publish Settings/i });
    fireEvent.click(saveBtn);

    expect(screen.getByRole('button', { name: /Publishing Changes.../i })).toBeDisabled();

    resolveSave();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save & Publish Settings/i })).not.toBeDisabled();
    });
  });
});
