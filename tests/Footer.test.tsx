import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../src/components/Footer';
import { SettingsProvider, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../src/context/SettingsContext';
import { SiteSettings } from '../src/types/settings';

const renderFooter = (override?: Partial<SiteSettings>) => {
  if (override) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...override })
    );
  }
  return render(
    <SettingsProvider>
      <Footer />
    </SettingsProvider>
  );
};

describe('Footer', () => {
  beforeEach(() => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  });

  it('renders compact social icon links in order with accessible labels and secure attributes', () => {
    const { container } = renderFooter({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: true },
        { id: '2', platform: 'instagram', url: 'https://instagram.com/weebles_clay', enabled: true },
        { id: '3', platform: 'tiktok', url: 'https://tiktok.com/@weebles_clay', enabled: false },
      ],
    });

    const nav = screen.getByRole('navigation', { name: /Social media links/i });
    expect(nav).toBeInTheDocument();
    const xLink = screen.getByRole('link', { name: /Visit us on X/i });
    const igLink = screen.getByRole('link', { name: /Visit us on Instagram/i });
    expect(xLink).toHaveAttribute('href', 'https://x.com/weebles_clay');
    expect(xLink).toHaveAttribute('target', '_blank');
    expect(xLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(igLink).toHaveAttribute('href', 'https://instagram.com/weebles_clay');
    expect(screen.queryByRole('link', { name: /Visit us on TikTok/i })).not.toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="x"]')).toBeInTheDocument();
  });

  it('hides the social icon bar when socialLinksEnabled is false or no links are enabled', () => {
    const { unmount } = renderFooter({ socialLinksEnabled: false });
    expect(screen.queryByLabelText(/Social media links/i)).not.toBeInTheDocument();
    unmount();

    renderFooter({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: false },
      ],
    });
    expect(screen.queryByLabelText(/Social media links/i)).not.toBeInTheDocument();
  });

  it('renders default Clay Care instructions without UV resin and supports custom Markdown overrides', () => {
    const { container, unmount } = renderFooter();
    expect(screen.getByText(/Clay Care Instructions/i)).toBeInTheDocument();
    expect(container.textContent).toContain('Durable baked polymer clay finish');
    expect(container.textContent).not.toMatch(/uv resin/i);
    unmount();

    renderFooter({
      pageContent: {
        ...DEFAULT_SETTINGS.pageContent!,
        footerCareTitle: '**Care** Guide ![heart](/images/content/heart.png)',
        footerCareBody: '- Keep *dry*\n- Wipe gently',
      },
    });

    expect(screen.getByText('Care').tagName).toBe('STRONG');
    expect(screen.getByAltText('heart')).toHaveAttribute('src', '/images/content/heart.png');
    expect(screen.getByText('dry').tagName).toBe('EM');
    expect(screen.getByText(/Wipe gently/i)).toBeInTheDocument();
  });
});
