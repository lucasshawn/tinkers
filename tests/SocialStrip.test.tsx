import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SocialStrip } from '../src/components/SocialStrip';

describe('SocialStrip', () => {
  it('renders TikTok, Instagram, and Facebook Marketplace links', () => {
    render(<SocialStrip />);

    expect(screen.getByText(/TikTok/i)).toBeInTheDocument();
    expect(screen.getByText(/Instagram/i)).toBeInTheDocument();
    expect(screen.getByText(/Facebook/i)).toBeInTheDocument();
  });

  it('renders section title and creator spotlight description', () => {
    render(<SocialStrip />);

    expect(screen.getByText(/Behind the Scenes & Restocks/i)).toBeInTheDocument();
    expect(screen.getByText(/Follow the Sculpting Journey!/i)).toBeInTheDocument();
    expect(screen.getByText(/Watch our clay ASMR sculpting clips/i)).toBeInTheDocument();
  });

  it('contains correct external URLs with secure attributes', () => {
    render(<SocialStrip />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);

    const tiktokLink = screen.getByRole('link', { name: /TikTok/i });
    expect(tiktokLink).toHaveAttribute('href', 'https://tiktok.com/@weebles_clay');
    expect(tiktokLink).toHaveAttribute('target', '_blank');
    expect(tiktokLink).toHaveAttribute('rel', 'noopener noreferrer');

    const instaLink = screen.getByRole('link', { name: /Instagram/i });
    expect(instaLink).toHaveAttribute('href', 'https://instagram.com/weebles_clay');
    expect(instaLink).toHaveAttribute('target', '_blank');
    expect(instaLink).toHaveAttribute('rel', 'noopener noreferrer');

    const fbLink = screen.getByRole('link', { name: /Facebook/i });
    expect(fbLink).toHaveAttribute('href', 'https://facebook.com/marketplace');
    expect(fbLink).toHaveAttribute('target', '_blank');
    expect(fbLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
