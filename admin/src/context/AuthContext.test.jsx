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
      <button type="button" onClick={() => login('root@store.test', 'pw').catch(() => {})}>
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

describe('AuthProvider rejects non-admin users', () => {
  it('signs out a stored customer session rather than rendering the panel', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockResolvedValue({ data: { email: 'shopper@store.test', role: 'customer' } });
    renderAuth();
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(tokenStore.access).toBeNull();
  });

  it('refuses login for a valid account that is not an administrator', async () => {
    mockApi.post.mockResolvedValue({ data: { access_token: 'a2', refresh_token: 'r2' } });
    mockApi.get.mockResolvedValue({ data: { email: 'shopper@store.test', role: 'customer' } });
    renderAuth();
    await userEvent.click(await screen.findByRole('button', { name: 'login' }));
    await waitFor(() => expect(tokenStore.access).toBeNull());
    expect(screen.getByText('signed out')).toBeInTheDocument();
  });
});

describe('AuthProvider admits admin users', () => {
  it('keeps the session for an administrator', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockResolvedValue({ data: { email: 'root@store.test', role: 'admin' } });
    renderAuth();
    expect(await screen.findByText('signed in as root@store.test')).toBeInTheDocument();
    expect(tokenStore.access).toBe('a1');
  });

  it('stores tokens then loads the admin profile on login', async () => {
    mockApi.post.mockResolvedValue({ data: { access_token: 'a3', refresh_token: 'r3' } });
    mockApi.get.mockResolvedValue({ data: { email: 'root@store.test', role: 'admin' } });
    renderAuth();
    await userEvent.click(await screen.findByRole('button', { name: 'login' }));
    expect(await screen.findByText('signed in as root@store.test')).toBeInTheDocument();
    expect(tokenStore.access).toBe('a3');
    expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
      email: 'root@store.test',
      password: 'pw',
    });
  });
});

describe('AuthProvider session handling', () => {
  it('stays signed out with no stored token and never calls the API', async () => {
    renderAuth();
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('clears the token when the profile request fails', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockRejectedValue(new Error('401'));
    renderAuth();
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(tokenStore.refresh).toBeNull();
  });

  it('signs out when the interceptor fires store:unauthorized', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockResolvedValue({ data: { email: 'root@store.test', role: 'admin' } });
    renderAuth();
    await screen.findByText('signed in as root@store.test');
    window.dispatchEvent(new Event('store:unauthorized'));
    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument());
  });

  it('clears local state on logout even when the API is unreachable', async () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    mockApi.get.mockResolvedValue({ data: { email: 'root@store.test', role: 'admin' } });
    mockApi.post.mockRejectedValue(new Error('network down'));
    renderAuth();
    await screen.findByText('signed in as root@store.test');
    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(await screen.findByText('signed out')).toBeInTheDocument();
    expect(tokenStore.access).toBeNull();
  });
});

describe('tokenStore', () => {
  it('stores and clears both tokens', async () => {
    tokenStore.set({ access_token: 'x', refresh_token: 'y' });
    expect(tokenStore.access).toBe('x');
    expect(tokenStore.refresh).toBe('y');
    tokenStore.clear();
    expect(tokenStore.access).toBeNull();
  });
});
