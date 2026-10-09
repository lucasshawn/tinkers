import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AdminLoginCard } from '../src/components/admin/AdminLoginCard';
import { adminAuth } from '../src/services/adminAuth';

describe('AdminLoginCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders studio login title and return link without mock login buttons', () => {
    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(screen.getByText(/Weebles Studio Manager/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login as Shawn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Login as Cierra/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Return to Storefront/i)).toBeInTheDocument();
  });

  it('shows missing Google client ID notice when VITE_GOOGLE_CLIENT_ID is not configured', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(screen.getByText(/Google OAuth Client ID is not configured/i)).toBeInTheDocument();
  });

  it('initializes Google SSO when VITE_GOOGLE_CLIENT_ID is set', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    const initializeMock = vi.fn();
    const renderButtonMock = vi.fn();

    (window as any).google = {
      accounts: {
        id: {
          initialize: initializeMock,
          renderButton: renderButtonMock,
        },
      },
    };

    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'test-client-id.apps.googleusercontent.com',
      })
    );
    expect(renderButtonMock).toHaveBeenCalled();
  });

  it('handles successful Google sign-in callback', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    let googleCallback: (resp: any) => Promise<void> = async () => {};
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }) => {
            googleCallback = callback;
          }),
          renderButton: vi.fn(),
        },
      },
    };

    const mockSession = {
      token: 'jwt-token',
      email: 'lucasshawn@gmail.com',
      name: 'Shawn',
    };
    vi.spyOn(adminAuth, 'loginWithCredential').mockResolvedValue(mockSession);
    const onLoginSuccess = vi.fn();

    render(<AdminLoginCard onLoginSuccess={onLoginSuccess} />);

    await act(async () => {
      await googleCallback({ credential: 'valid-google-jwt' });
    });

    expect(onLoginSuccess).toHaveBeenCalledWith(mockSession);
  });

  it('displays error banner when Google sign-in is rejected', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    let googleCallback: (resp: any) => Promise<void> = async () => {};
    (window as any).google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }) => {
            googleCallback = callback;
          }),
          renderButton: vi.fn(),
        },
      },
    };

    vi.spyOn(adminAuth, 'loginWithCredential').mockRejectedValue(
      new Error('Unauthorized: stranger@gmail.com is not an authorized administrator.')
    );

    render(<AdminLoginCard onLoginSuccess={vi.fn()} />);

    await act(async () => {
      await googleCallback({ credential: 'unauthorized-jwt' });
    });

    await waitFor(() => {
      expect(
        screen.getByText(/stranger@gmail.com is not an authorized administrator/i)
      ).toBeInTheDocument();
    });
  });
});
