import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  return { ...actual, default: mockApi };
});

const { AuthProvider, useAuth } = await import('./AuthContext.jsx');
const { tokenStore } = await import('../lib/api.js');

function Probe() {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `signed in as ${user.email}` : 'signed out'}</p>
      <button type="button" onClick={() => login('a@b.com', 'pw')}>
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockApi.get.mockReset();
  mockApi.post.mockReset();
});

describe('AuthProvider without a stored token', () => {
  it('stays signed out and never calls the API', async () => {
    renderAuth();
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

describe('AuthProvider with a stored token', () => {
  it('loads the profile for a signed-in user', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockResolvedValue({ data: { email: 'a@b.com', role: 'customer' } });
    renderAuth();
    expect(await screen.findByText('signed in as a@b.com')).toBeInTheDocument();
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
  });

  it('clears the token and stays signed out when the profile request fails', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockRejectedValue(new Error('401'));
    renderAuth();
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(tokenStore.access).toBeNull();
  });

  it('signs out when the interceptor fires store:unauthorized', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockResolvedValue({ data: { email: 'a@b.com', role: 'customer' } });
    renderAuth();
    await screen.findByText('signed in as a@b.com');
    window.dispatchEvent(new Event('store:unauthorized'));
    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument());
  });
});

describe('AuthProvider login and logout', () => {
  it('stores the returned tokens and shows the profile', async () => {
    mockApi.post.mockResolvedValue({ data: { access_token: 'a9', refresh_token: 'r9' } });
    mockApi.get.mockResolvedValue({ data: { email: 'a@b.com', role: 'customer' } });
    renderAuth();
    await userEvent.click(await screen.findByRole('button', { name: 'login' }));
    expect(await screen.findByText('signed in as a@b.com')).toBeInTheDocument();
    expect(tokenStore.access).toBe('a9');
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'pw',
    });
  });

  it('clears local state on logout even when the API is unreachable', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockResolvedValue({ data: { email: 'a@b.com', role: 'customer' } });
    mockApi.post.mockRejectedValue(new Error('network down'));
    renderAuth();
    await screen.findByText('signed in as a@b.com');
    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(tokenStore.access).toBeNull();
  });
});

describe('useAuth', () => {
  it('throws a helpful error when used outside the provider', async () => {
    const { useAuth: hook } = await import('./AuthContext.jsx');
    function Bare() {
      hook();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow('useAuth must be used inside <AuthProvider>');
    spy.mockRestore();
  });
});
