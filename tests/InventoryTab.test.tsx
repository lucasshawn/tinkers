import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InventoryTab } from '../src/components/admin/InventoryTab';
import { Product } from '../src/types';

const mockProducts: Product[] = [
  {
    id: 'weeble-bee',
    name: 'Chubby Bumblebee',
    description: 'Sweet honey bee',
    price: 14.0,
    images: ['/images/products/bumblebee.jpg'],
    category: 'animals',
    availableVariants: ['magnet', 'keychain'],
    inStock: true,
    stockCount: 2,
    featured: true,
  },
  {
    id: 'weeble-strawberry',
    name: 'Berry Sweetie',
    description: 'Delicious strawberry treat',
    price: 16.5,
    images: ['/images/products/strawberry.jpg'],
    category: 'sweets',
    availableVariants: ['magnet'],
    inStock: false,
    stockCount: 0,
    isOneOfAKind: true,
  },
];

describe('InventoryTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders products and allows opening add product drawer', () => {
    render(<InventoryTab products={mockProducts} onSave={vi.fn()} />);

    expect(screen.getByText('Chubby Bumblebee')).toBeInTheDocument();
    expect(screen.getByText('$14.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Add New Weeble/i })).toBeInTheDocument();
  });

  it('opens editor modal with product data when clicking edit', () => {
    render(<InventoryTab products={mockProducts} onSave={vi.fn()} />);

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    expect(screen.getByText(/Edit Weeble/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chubby Bumblebee')).toBeInTheDocument();
  });

  it('filters products using the search input', () => {
    render(<InventoryTab products={mockProducts} onSave={vi.fn()} />);

    expect(screen.getByText('Chubby Bumblebee')).toBeInTheDocument();
    expect(screen.getByText('Berry Sweetie')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search catalog/i);
    fireEvent.change(searchInput, { target: { value: 'strawberry' } });

    expect(screen.queryByText('Chubby Bumblebee')).not.toBeInTheDocument();
    expect(screen.getByText('Berry Sweetie')).toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Chubby Bumblebee')).toBeInTheDocument();
  });

  it('adds a new product and invokes onSave', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: /Add New Weeble/i })).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'Rainbow Bunny' } });

    const priceInput = screen.getByLabelText(/Price/i);
    fireEvent.change(priceInput, { target: { value: '18.00' } });

    const descInput = screen.getByLabelText(/Description/i);
    fireEvent.change(descInput, { target: { value: 'A cute rainbow bunny figurine' } });

    const saveBtn = screen.getByRole('button', { name: /Save Weeble/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    expect(savedProducts).toHaveLength(3);
    expect(savedProducts[0].name).toBe('Rainbow Bunny');
    expect(savedProducts[0].price).toBe(18);
  });

  it('edits an existing product and invokes onSave with updated list', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]); // Edit Bumblebee

    const nameInput = screen.getByDisplayValue('Chubby Bumblebee');
    fireEvent.change(nameInput, { target: { value: 'Golden Bumblebee' } });

    const saveBtn = screen.getByRole('button', { name: /Save Weeble/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    expect(savedProducts).toHaveLength(2);
    expect(savedProducts[0].id).toBe('weeble-bee');
    expect(savedProducts[0].name).toBe('Golden Bumblebee');
  });

  it('deletes a product when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const deleteBtns = screen.getAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    expect(savedProducts).toHaveLength(1);
    expect(savedProducts[0].id).toBe('weeble-strawberry');
  });

  it('does not delete when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const handleSave = vi.fn().mockResolvedValue(undefined);

    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const deleteBtns = screen.getAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtns[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('closes editor modal with Escape key or close button', () => {
    render(<InventoryTab products={mockProducts} onSave={vi.fn()} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Escape closes modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Open again and click Close button
    fireEvent.click(addBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles image file upload and passes newImage to onSave', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    const fileInput = screen.getByLabelText(/Product Photo/i) as HTMLInputElement;
    const file = new File(['dummy-content'], 'rainbow.png', { type: 'image/png' });

    const mockResult = 'data:image/png;base64,ZHVtbXktY29udGVudA==';
    const originalFileReader = window.FileReader;
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = mockResult;
        if (this.onload) {
          this.onload();
        }
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Preview should appear
    expect(screen.getByAltText('Preview')).toHaveAttribute('src', mockResult);

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Rainbow Weeble' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Rainbow friend' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const [savedProducts, newImage] = handleSave.mock.calls[0];
    expect(newImage).toEqual({
      filename: 'rainbow.png',
      base64Data: mockResult,
    });
    expect(savedProducts[0].images[0]).toBe('/images/products/rainbow.png');

    window.FileReader = originalFileReader;
  });

  it('handles category selection and stock toggles', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Sparkle Cat' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Magical kitten' } });
    fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'fantasy' } });

    // Toggle 1-of-1
    const oneOfAKindCheckbox = screen.getByLabelText(/1-of-1 Original/i);
    fireEvent.click(oneOfAKindCheckbox);

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    expect(savedProducts[0].category).toBe('fantasy');
    expect(savedProducts[0].isOneOfAKind).toBe(true);
    expect(savedProducts[0].stockCount).toBe(1);
  });
});
