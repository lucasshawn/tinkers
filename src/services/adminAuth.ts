export interface AdminSession {
  token: string;
  email: string;
  name?: string;
  picture?: string;
  exp?: number;
}

const STORAGE_KEY = 'weebles_admin_session_v1';

export const adminAuth = {
  getSession(): AdminSession | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const session = JSON.parse(stored) as AdminSession;
      if (session.exp && Date.now() > session.exp) {
        this.logout();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  setSession(session: AdminSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  async loginWithCredential(credential: string): Promise<AdminSession> {
    const res = await fetch('/.netlify/functions/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Authentication failed');
    }

    const session: AdminSession = await res.json();
    this.setSession(session);
    return session;
  },

  async devLogin(email = 'lucasshawn@gmail.com'): Promise<AdminSession> {
    const res = await fetch('/.netlify/functions/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, devBypass: true }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Dev login failed');
    }

    const session: AdminSession = await res.json();
    this.setSession(session);
    return session;
  },
};
