import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnnouncementBanner } from '../src/components/AnnouncementBanner';

describe('AnnouncementBanner', () => {
  it('renders message when enabled and text is present', () => {
    render(<AnnouncementBanner banner={{ enabled: true, text: '🌸 Fall Restock is live!' }} />);
    expect(screen.getByText(/Fall Restock is live!/i)).toBeInTheDocument();
  });

  it('renders nothing when disabled or empty text', () => {
    const { container: c1 } = render(<AnnouncementBanner banner={{ enabled: false, text: 'Sale!' }} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<AnnouncementBanner banner={{ enabled: true, text: '   ' }} />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<AnnouncementBanner banner={undefined} />);
    expect(c3.firstChild).toBeNull();
  });
});
