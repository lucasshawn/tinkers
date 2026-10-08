import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AdminLoginCard } from '../src/components/admin/AdminLoginCard';
import { adminAuth } from '../src/services/adminAuth';

describe('AdminLoginCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders studio login title, whitelist notice, and return link', () => {
    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
    expect(screen.getByText(/lucasshawn@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText(/lucascierra24@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Storefront/i)).toBeInTheDocument();
  });

  it('authenticates successfully via dev bypass login for Shawn', async () => {
    const handleSuccess = vi.fn();
    vi.spyOn(adminAuth, 'devLogin').mockResolvedValue({
      token: 'shawn-token',
      email: 'lucasshawn@gmail.com',
      name: 'Shawn',
    });

    render(<AdminLoginCard onLoginSuccess={handleSuccess} />);

    const shawnBtn = screen.getByRole('button', { name: /Login as Shawn/i });
    fireEvent.click(shawnBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'lucasshawn@gmail.com' })
      );
    });
  });

  it('authenticates successfully via dev bypass login for Cierra', async () => {
    const handleSuccess = vi.fn();
    vi.spyOn(adminAuth, 'devLogin').mockResolvedValue({
      token: 'cierra-token',
      email: 'lucascierra24@gmail.com',
      name: 'Cierra',
    });

    render(<AdminLoginCard onLoginSuccess={handleSuccess} />);

    const cierraBtn = screen.getByRole('button', { name: /Login as Cierra/i });
    fireEvent.click(cierraBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'lucascierra24@gmail.com' })
      );
    });
  });

  it('displays error message banner when dev login fails', async () => {
    vi.spyOn(adminAuth, 'devLogin').mockRejectedValue(new Error('Unauthorized email'));

    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    const shawnBtn = screen.getByRole('button', { name: /Login as Shawn/i });
    fireEvent.click(shawnBtn);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized email')).toBeInTheDocument();
    });
  });

  it('initializes Google SSO and handles successful callback', async () => {
    const handleSuccess = vi.fn();
    vi.spyOn(adminAuth, 'loginWithCredential').mockResolvedValue({
      token: 'google-token',
      email: 'lucasshawn@gmail.com',
      name: 'Shawn',
    });

    // Mock import.meta.env.VITE_GOOGLE_CLIENT_ID
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');

    let capturedCallback: ((response: any) => Promise<void>) | null = null;
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn().mockImplementation((config: any) => {
            capturedCallback = config.callback;
          }),
          renderButton: vi.fn(),
        },
      },
    };

    render(<AdminLoginCard onLoginSuccess={handleSuccess} />);

    expect((window as any).google.accounts.id.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'test-google-client-id' })
    );
    expect((window as any).google.accounts.id.renderButton).toHaveBeenCalled();

    // Trigger Google callback
    expect(capturedCallback).not.toBeNull();
    await act(async () => {
      await capturedCallback!({ credential: 'fake-jwt-token' });
    });

    expect(adminAuth.loginWithCredential).toHaveBeenCalledWith('fake-jwt-token');
    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'lucasshawn@gmail.com' })
    );
  });

  it('displays error when Google SSO callback fails', async () => {
    vi.spyOn(adminAuth, 'loginWithCredential').mockRejectedValue(new Error('Access denied by server'));

    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-google-client-id');

    let capturedCallback: ((response: any) => Promise<void>) | null = null;
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn().mockImplementation((config: any) => {
            capturedCallback = config.callback;
          }),
          renderButton: vi.fn(),
        },
      },
    };

    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    await act(async () => {
      await capturedCallback!({ credential: 'fake-jwt-token' });
    });

    await waitFor(() => {
      expect(screen.getByText('Access denied by server')).toBeInTheDocument();
    });
  });
});
