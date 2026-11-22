import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialStrip } from '../src/components/SocialStrip';
import { SettingsProvider, SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../src/context/SettingsContext';
import { SiteSettings } from '../src/types/settings';

const renderWithSettings = (override?: Partial<SiteSettings>) => {
  if (override) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...override })
    );
  }
  return render(
    <SettingsProvider>
      <SocialStrip />
    </SettingsProvider>
  );
};

describe('SocialStrip', () => {
  beforeEach(() => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  });

  it('renders TikTok, Instagram, and Facebook Marketplace links by default', () => {
    render(<SocialStrip />);

    expect(screen.getByText(/TikTok/i)).toBeInTheDocument();
    expect(screen.getByText(/Instagram/i)).toBeInTheDocument();
    expect(screen.getByText(/Facebook Marketplace/i)).toBeInTheDocument();
  });

  it('renders section title and creator spotlight description', () => {
    render(<SocialStrip />);

    expect(screen.getByText(/Behind the Scenes & Restocks/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow the Sculpting Journey!/i)).toBeInTheDocument();
    expect(screen.getByText(/Watch our clay ASMR sculpting clips/i)).toBeInTheDocument();
  });

  it('contains correct external URLs with secure attributes and brand SVG icons', () => {
    const { container } = render(<SocialStrip />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);

    const tiktokLink = screen.getByRole('link', { name: /TikTok/i });
    expect(tiktokLink).toHaveAttribute('href', 'https://tiktok.com/@weebles_clay');
    expect(tiktokLink).toHaveAttribute('target', '_blank');
    expect(tiktokLink).toHaveAttribute('rel', 'noopener noreferrer');

    const instaLink = screen.getByRole('link', { name: /Instagram/i });
    expect(instaLink).toHaveAttribute('href', 'https://instagram.com/weebles_clay');

    const fbLink = screen.getByRole('link', { name: /Facebook Marketplace/i });
    expect(fbLink).toHaveAttribute('href', 'https://facebook.com/marketplace');

    expect(container.querySelector('[data-social-icon="tiktok"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="instagram"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="facebookMarketplace"]')).toBeInTheDocument();
  });

  it('hides the entire section when master socialLinksEnabled is false', () => {
    const { container } = renderWithSettings({ socialLinksEnabled: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('hides individually disabled links and hides entire section when all links are disabled', () => {
    const { unmount } = renderWithSettings({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: true },
        { id: '2', platform: 'tiktok', url: 'https://tiktok.com/@weebles_clay', enabled: false },
      ],
    });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://x.com/weebles_clay');
    expect(screen.getByText('@weebles_clay')).toBeInTheDocument();
    expect(screen.queryByText(/TikTok/i)).not.toBeInTheDocument();
    unmount();

    const { container } = renderWithSettings({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: false },
      ],
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders added platforms like X, YouTube, and Etsy with adaptive grid', () => {
    const { container } = renderWithSettings({
      socialLinksEnabled: true,
      socialLinks: [
        { id: '1', platform: 'x', url: 'https://x.com/weebles_clay', enabled: true, subtitle: 'Drops & News' },
        { id: '2', platform: 'youtube', url: 'https://youtube.com/@weebles_clay', enabled: true },
        { id: '3', platform: 'etsy', url: 'https://etsy.com/shop/weeblesclay', enabled: true },
        { id: '4', platform: 'pinterest', url: 'https://pinterest.com/weebles_clay', enabled: true },
      ],
    });

    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByText('Drops & News')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="x"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="youtube"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="etsy"]')).toBeInTheDocument();
    expect(container.querySelector('[data-social-icon="pinterest"]')).toBeInTheDocument();
  });

  it('renders custom Markdown badge, title, and subtitle from pageContent settings', () => {
    renderWithSettings({
      pageContent: {
        ...DEFAULT_SETTINGS.pageContent!,
        socialBadge: '**Live** Restocks ![sparkle](/images/content/sparkle.png)',
        socialTitle: 'Join Our [Clay Club]{color=pink}',
        socialSubtitle: 'Watch *weekly* drops!',
      },
    });

    expect(screen.getByText('Live').tagName).toBe('STRONG');
    expect(screen.getByAltText('sparkle')).toHaveAttribute('src', '/images/content/sparkle.png');
    expect(screen.getByText('Clay Club')).toHaveStyle({ color: '#FF85A1' });
    expect(screen.getByText('weekly').tagName).toBe('EM');
  });
});
