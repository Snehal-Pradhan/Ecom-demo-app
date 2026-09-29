import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProductCard from './ProductCard.jsx';

const product = {
  id: 7,
  name: 'Cast Iron Skillet',
  description: 'Heavy, seasoned, and preheated for the oven.',
  price: '39.95',
  category: 'Kitchen',
  image_url: 'https://example.com/skillet.jpg',
  stock: 3,
};

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <ProductCard product={product} {...props} />
    </MemoryRouter>,
  );
}

describe('ProductCard', () => {
  it('shows the name, price, and category', () => {
    renderCard();
    expect(screen.getByText('Cast Iron Skillet')).toBeInTheDocument();
    expect(screen.getByText('$39.95')).toBeInTheDocument();
    expect(screen.getByText('Kitchen')).toBeInTheDocument();
  });

  it('links the product name and image to its detail page', () => {
    renderCard();
    // Both the image and the title link to the same detail page, so the card
    // is fully clickable. getAllByRole because the two share an accessible name.
    const links = screen.getAllByRole('link', { name: 'Cast Iron Skillet' });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/products/7');
    }
  });

  it('passes the product to onAdd when clicked', async () => {
    const onAdd = vi.fn();
    renderCard({ onAdd });
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onAdd).toHaveBeenCalledWith(product);
  });

  it('hides the add button and marks the product out of stock at zero stock', () => {
    renderCard({ product: { ...product, stock: 0 } });
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
  });

  it('disables the button and shows progress while busy', () => {
    renderCard({ busy: true });
    const button = screen.getByRole('button', { name: 'Adding...' });
    expect(button).toBeDisabled();
  });

  it('falls back to a placeholder when the product has no image', () => {
    renderCard({ product: { ...product, image_url: null } });
    expect(screen.getByText('No image')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('does not throw when clicked without an onAdd handler', async () => {
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  });
});

describe('ProductCard in a route', () => {
  it('resolves its links against the surrounding router', () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route path="/products" element={<ProductCard product={product} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link', { name: 'Cast Iron Skillet' })[0]).toHaveAttribute(
      'href',
      '/products/7',
    );
  });
});
