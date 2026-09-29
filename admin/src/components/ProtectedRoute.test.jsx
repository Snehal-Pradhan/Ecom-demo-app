import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute.jsx';

const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: mockUseAuth }));

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/products']}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <p>products page</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('renders the children for a signed-in user', () => {
    mockUseAuth.mockReturnValue({ user: { email: 'a@b.com' }, loading: false });
    renderRoute();
    expect(screen.getByText('products page')).toBeInTheDocument();
  });

  it('redirects a signed-out user to the login page', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    renderRoute();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('products page')).not.toBeInTheDocument();
  });

  it('shows a spinner and does not redirect while the session is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    renderRoute();
    // A hard refresh must not bounce a signed-in user to /login before the
    // stored token has been validated, so loading is checked first.
    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});
