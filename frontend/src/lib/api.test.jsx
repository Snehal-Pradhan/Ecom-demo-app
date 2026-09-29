import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { errorMessage, tokenStore } from './api.js';

describe('errorMessage', () => {
  it('returns a string detail verbatim', () => {
    const error = { response: { data: { detail: 'Email already registered' } } };
    expect(errorMessage(error)).toBe('Email already registered');
  });

  it('unwraps the first message from a FastAPI validation array', () => {
    const error = { response: { data: { detail: [{ msg: 'field required' }] } } };
    expect(errorMessage(error)).toBe('field required');
  });

  it('reports a timeout distinctly from a generic failure', () => {
    expect(errorMessage({ code: 'ECONNABORTED' })).toBe('The request timed out.');
  });

  it('suggests checking the backend when there is no response at all', () => {
    expect(errorMessage({})).toBe('Cannot reach the API. Is the backend running?');
  });

  it('uses the caller fallback for a response with no usable detail', () => {
    const error = { response: { data: {} } };
    expect(errorMessage(error, 'Could not save.')).toBe('Could not save.');
  });
});

describe('tokenStore', () => {
  it('starts empty', () => {
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
  });

  it('stores both tokens together', () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    expect(tokenStore.access).toBe('a1');
    expect(tokenStore.refresh).toBe('r1');
  });

  it('ignores a missing refresh token rather than writing null', () => {
    tokenStore.set({ access_token: 'a2', refresh_token: 'r2' });
    tokenStore.set({ access_token: 'a3' });
    expect(tokenStore.access).toBe('a3');
    expect(tokenStore.refresh).toBe('r2');
  });

  it('clears both tokens', () => {
    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    tokenStore.clear();
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
  });
});

describe('errorMessage inside a component tree', () => {
  it('renders the backend message through ErrorBanner', async () => {
    const { ErrorBanner } = await import('../components/ui.jsx');
    const error = { response: { data: { detail: 'Not enough stock' } } };
    render(<ErrorBanner message={errorMessage(error)} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Not enough stock');
  });

  it('renders a retry button only when onRetry is supplied', async () => {
    const { ErrorBanner } = await import('../components/ui.jsx');
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorBanner message="Boom" />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    rerender(<ErrorBanner message="Boom" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
