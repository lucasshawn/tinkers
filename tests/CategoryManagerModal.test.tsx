import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryManagerModal } from '../src/components/admin/CategoryManagerModal';
import { CategoryOption, Product } from '../src/types';

const categories: CategoryOption[] = [
  { id: 'animals', label: 'Critters', emoji: '🐰' },
  { id: 'sweets', label: 'Sweets', emoji: '🍩' },
  { id: 'mini-friends', label: 'Mini-Friends', emoji: '🌸' },
];

const products: Product[] = [
  {
    id: 'p1',
    name: 'Candy Bunny',
    description: 'Sweet bunny',
    price: 14,
    images: ['/images/products/bunny.jpg'],
    categories: ['animals', 'sweets'],
    availableVariants: ['magnet'],
    inStock: true,
    stockCount: 2,
  },
  {
    id: 'p2',
    name: 'Macaron',
    description: 'Pink macaron',
    price: 14.5,
    images: ['/images/products/macaron.jpg'],
    categories: ['sweets'],
    availableVariants: ['keychain'],
    inStock: true,
    stockCount: 3,
  },
];

describe('CategoryManagerModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders categories with item usage counts and adds a new category with optional emoji', async () => {
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    expect(screen.getByText('🐰 Critters')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
    expect(screen.getByText('🍩 Sweets')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('🌸 Mini-Friends')).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Emoji/i), { target: { value: '🎃' } });
    fireEvent.change(screen.getByLabelText(/Category Name/i), {
      target: { value: 'Spooky Season' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));

    await waitFor(() => {
      expect(onSaveCategories).toHaveBeenCalledTimes(1);
    });

    expect(onSaveCategories).toHaveBeenCalledWith([
      ...categories,
      { id: 'spooky-season', label: 'Spooky Season', emoji: '🎃' },
    ]);
  });

  it('rejects empty names and duplicate category names/slugs inline', () => {
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    // Empty name
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));
    expect(screen.getByText(/Please enter a category name/i)).toBeInTheDocument();
    expect(onSaveCategories).not.toHaveBeenCalled();

    // Duplicate label (case-insensitive)
    fireEvent.change(screen.getByLabelText(/Category Name/i), { target: { value: 'sweets' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(onSaveCategories).not.toHaveBeenCalled();
  });

  it('confirms affected item count and removes deleted category from both category list and products', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sweets' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Remove "Sweets"? This will also remove it from 2 catalog items.'
    );

    await waitFor(() => {
      expect(onSaveCategories).toHaveBeenCalledTimes(1);
    });

    const [updatedCategories, updatedProducts] = onSaveCategories.mock.calls[0];
    expect(updatedCategories.map((c: CategoryOption) => c.id)).toEqual(['animals', 'mini-friends']);
    expect(updatedProducts[0].categories).toEqual(['animals']);
    expect(updatedProducts[1].categories).toEqual([]);
  });

  it('does not delete when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);

    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Sweets' }));
    expect(onSaveCategories).not.toHaveBeenCalled();
  });

  it('closes on Escape key and backdrop click', () => {
    const onClose = vi.fn();
    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={onClose}
        onSaveCategories={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('category-modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not render when closed and validates non-alphanumeric names', () => {
    const { container } = render(
      <CategoryManagerModal
        isOpen={false}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();

    const onSaveCategories = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.change(screen.getByLabelText(/Category Name/i), { target: { value: '!!!' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Category/i }));
    expect(screen.getByText(/must include letters or numbers/i)).toBeInTheDocument();
    expect(onSaveCategories).not.toHaveBeenCalled();
  });

  it('displays error message if saving fails and uses simple confirm for unused categories', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSaveCategories = vi.fn().mockRejectedValueOnce(new Error('Save failed'));

    render(
      <CategoryManagerModal
        isOpen={true}
        categories={categories}
        products={products}
        onClose={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove Mini-Friends' }));
    expect(confirmSpy).toHaveBeenCalledWith('Remove category "Mini-Friends"?');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
    });
  });
});
