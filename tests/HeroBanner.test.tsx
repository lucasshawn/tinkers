import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroBanner } from '../src/components/HeroBanner';
import {
  SettingsProvider,
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
} from '../src/context/SettingsContext';
import { SiteSettings } from '../src/types/settings';

const renderHero = (override?: Partial<SiteSettings>) => {
  if (override) {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...override })
    );
  }
  return render(
    <SettingsProvider>
      <HeroBanner onExploreClick={vi.fn()} onCustomClick={vi.fn()} />
    </SettingsProvider>
  );
};

describe('HeroBanner', () => {
  beforeEach(() => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  });

  it('renders default Markdown hero copy without UV resin and with pink wavy Fridge & Keys', () => {
    const { container } = renderHero();

    expect(screen.getByText(/Hand-Sculpted Polymer Clay with Love/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/uv resin/i);
    expect(container.textContent).not.toMatch(/sculpey|sculpty/i);

    const wavyPhrase = screen.getByText('Fridge & Keys');
    expect(wavyPhrase).toHaveStyle({ color: '#FF85A1' });
    expect(wavyPhrase.className).toContain('decoration-wavy');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('✨');
  });

  it('renders custom Markdown tagline, title, and subtitle with inline PNGs and styles', () => {
    renderHero({
      pageContent: {
        ...DEFAULT_SETTINGS.pageContent!,
        heroTagline: '**New** Studio Drop ![star](/images/content/star.png)',
        heroTitle: 'Meet Our [Mini Critters]{color=#7C3AED font=serif}',
        heroSubtitle: 'Handcrafted *daily* in small batches.',
      },
    });

    expect(screen.getByText('New').tagName).toBe('STRONG');
    expect(screen.getByAltText('star')).toHaveAttribute('src', '/images/content/star.png');
    expect(screen.getByText('Mini Critters')).toHaveStyle({ color: '#7C3AED' });
    expect(screen.getByText('daily').tagName).toBe('EM');
  });
});
