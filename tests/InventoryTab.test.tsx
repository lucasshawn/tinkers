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
    variantPrices: {
      magnet: 14.0,
      keychain: 14.0,
    },
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
    variantPrices: {
      magnet: 16.5,
    },
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

  it('displays separate magnet and keychain prices in the inventory list when they differ', () => {
    const productsWithDiffPrices: Product[] = [
      {
        ...mockProducts[0],
        variantPrices: {
          magnet: 14.0,
          keychain: 16.5,
        },
      },
    ];
    render(<InventoryTab products={productsWithDiffPrices} onSave={vi.fn()} />);

    expect(screen.getByText('🧲 $14.00 / 🔑 $16.50')).toBeInTheDocument();
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

  it('adds a new product with separate magnet and keychain prices and invokes onSave', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: /Add New Weeble/i })).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByLabelText(/Name/i);
    fireEvent.change(nameInput, { target: { value: 'Rainbow Bunny' } });

    const magnetPriceInput = screen.getByLabelText(/Magnet Price/i);
    fireEvent.change(magnetPriceInput, { target: { value: '18.00' } });

    const keychainPriceInput = screen.getByLabelText(/Keychain Price/i);
    fireEvent.change(keychainPriceInput, { target: { value: '19.50' } });

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
    expect(savedProducts[0].variantPrices).toEqual({
      magnet: 18,
      keychain: 19.5,
    });
  });

  it('allows unchecking both magnet and keychain to save a product with no variant options and a single base price', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    fireEvent.click(screen.getByRole('button', { name: /\+ Add New Weeble/i }));

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Desk Sculpture' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Standalone figurine' } });

    // Uncheck both magnet and keychain
    fireEvent.click(screen.getByRole('checkbox', { name: /Refrigerator Magnet/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Keychain/i }));

    expect(screen.queryByLabelText(/Magnet Price/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Keychain Price/i)).not.toBeInTheDocument();

    const basePriceInput = screen.getByLabelText(/Price \(\$ USD\)/i);
    fireEvent.change(basePriceInput, { target: { value: '22.00' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProduct: Product = handleSave.mock.calls[0][0][0];
    expect(savedProduct.availableVariants).toEqual([]);
    expect(savedProduct.price).toBe(22);
    expect(savedProduct.variantPrices).toEqual({});
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

    const [savedProducts, newImages] = handleSave.mock.calls[0];
    expect(newImages).toEqual([
      {
        filename: 'rainbow.png',
        base64Data: mockResult,
      },
    ]);
    expect(savedProducts[0].images[0]).toBe('/images/products/rainbow.png');

    window.FileReader = originalFileReader;
  });

  it('sanitizes uploaded image filename to remove special characters and spaces', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    const fileInput = screen.getByLabelText(/Product Photo/i) as HTMLInputElement;
    const file = new File(['dummy-content'], 'sweet strawberry #1 (special).png', { type: 'image/png' });

    const mockResult = 'data:image/png;base64,ZHVtbXk=';
    const originalFileReader = window.FileReader;
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = mockResult;
        if (this.onload) this.onload();
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Sweet Berry' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Berry treat' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const [savedProducts, newImages] = handleSave.mock.calls[0];
    expect(newImages).toEqual([
      {
        filename: 'sweetstrawberry1special.png',
        base64Data: mockResult,
      },
    ]);
    expect(savedProducts[0].images[0]).toBe('/images/products/sweetstrawberry1special.png');

    window.FileReader = originalFileReader;
  });

  it('uploads magnet and keychain variant photos alongside base photo and passes all in newImages', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]); // Edit weeble-bee (magnet & keychain)

    const originalFileReader = window.FileReader;
    let callCount = 0;
    const mockResults = [
      'data:image/png;base64,bWFnbmV0',
      'data:image/png;base64,a2V5Y2hhaW4=',
    ];
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = mockResults[callCount++] || mockResults[0];
        if (this.onload) this.onload();
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    const magnetInput = screen.getByLabelText(/Upload Magnet photo/i);
    fireEvent.change(magnetInput, {
      target: { files: [new File(['m'], 'photo.png', { type: 'image/png' })] },
    });

    const keychainInput = screen.getByLabelText(/Upload Keychain photo/i);
    fireEvent.change(keychainInput, {
      target: { files: [new File(['k'], 'photo.png', { type: 'image/png' })] },
    });

    expect(screen.getByAltText('Magnet preview')).toHaveAttribute('src', mockResults[0]);
    expect(screen.getByAltText('Keychain preview')).toHaveAttribute('src', mockResults[1]);

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const [savedProducts, newImages] = handleSave.mock.calls[0];
    const updatedBee: Product = savedProducts[0];
    expect(updatedBee.variantImages).toEqual({
      magnet: '/images/products/weeble-bee-magnet-photo.png',
      keychain: '/images/products/weeble-bee-keychain-photo.png',
    });
    expect(newImages).toEqual([
      { filename: 'weeble-bee-magnet-photo.png', base64Data: mockResults[0] },
      { filename: 'weeble-bee-keychain-photo.png', base64Data: mockResults[1] },
    ]);

    window.FileReader = originalFileReader;
  });

  it('allows replacing (editing) and removing (deleting) existing variant photos', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const productsWithVariantPhotos: Product[] = [
      {
        ...mockProducts[0],
        variantImages: {
          magnet: '/images/products/bee-magnet-old.jpg',
          keychain: '/images/products/bee-keychain-old.jpg',
        },
      },
    ];

    render(<InventoryTab products={productsWithVariantPhotos} onSave={handleSave} />);

    // Inventory list displays variant photo count indicator
    expect(screen.getByText(/📷 \+2 photos/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    expect(screen.getByAltText('Magnet preview')).toHaveAttribute(
      'src',
      '/images/products/bee-magnet-old.jpg'
    );
    expect(screen.getByAltText('Keychain preview')).toHaveAttribute(
      'src',
      '/images/products/bee-keychain-old.jpg'
    );

    // Replace magnet photo
    const originalFileReader = window.FileReader;
    const replacementDataUrl = 'data:image/jpeg;base64,bmV3bWFnbmV0';
    class MockFileReader {
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;
      readAsDataURL() {
        this.result = replacementDataUrl;
        if (this.onload) this.onload();
      }
    }
    // @ts-expect-error Mocking FileReader
    window.FileReader = MockFileReader;

    fireEvent.change(screen.getByLabelText(/Change Magnet photo/i), {
      target: { files: [new File(['new'], 'fresh.jpg', { type: 'image/jpeg' })] },
    });
    expect(screen.getByAltText('Magnet preview')).toHaveAttribute('src', replacementDataUrl);

    // Remove keychain photo
    fireEvent.click(screen.getByRole('button', { name: /Remove Keychain photo/i }));
    expect(screen.queryByAltText('Keychain preview')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const [savedProducts, newImages] = handleSave.mock.calls[0];
    expect(savedProducts[0].variantImages).toEqual({
      magnet: '/images/products/weeble-bee-magnet-fresh.jpg',
    });
    expect(newImages).toEqual([
      { filename: 'weeble-bee-magnet-fresh.jpg', base64Data: replacementDataUrl },
    ]);

    window.FileReader = originalFileReader;
  });

  it('omits variantImages for unchecked variants on save', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const productsWithVariantPhotos: Product[] = [
      {
        ...mockProducts[0],
        variantImages: {
          magnet: '/images/products/bee-magnet.jpg',
          keychain: '/images/products/bee-keychain.jpg',
        },
      },
    ];

    render(<InventoryTab products={productsWithVariantPhotos} onSave={handleSave} />);
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    // Uncheck keychain
    fireEvent.click(screen.getByRole('checkbox', { name: /Keychain/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProduct: Product = handleSave.mock.calls[0][0][0];
    expect(savedProduct.variantImages).toEqual({
      magnet: '/images/products/bee-magnet.jpg',
    });
  });

  it('handles multi-select category selection and stock toggles', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const addBtn = screen.getByRole('button', { name: /\+ Add New Weeble/i });
    fireEvent.click(addBtn);

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Sparkle Cat' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Magical kitten' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Fantasy/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Critters/i }));

    // Toggle 1-of-1
    const oneOfAKindCheckbox = screen.getByLabelText(/1-of-1 Original/i);
    fireEvent.click(oneOfAKindCheckbox);

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    expect(savedProducts[0].categories).toEqual(['fantasy', 'animals']);
    expect(savedProducts[0].category).toBeUndefined();
    expect(savedProducts[0].isOneOfAKind).toBe(true);
    expect(savedProducts[0].stockCount).toBe(1);
  });

  it('pre-checks existing categories when editing a multi-category item and displays multiple categories in inventory list', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const multiProducts: Product[] = [
      {
        ...mockProducts[0],
        categories: ['animals', 'sweets'],
        category: undefined,
      },
      {
        ...mockProducts[1],
        categories: [],
        category: undefined,
      },
    ];

    render(<InventoryTab products={multiProducts} onSave={handleSave} />);

    expect(screen.getByText('🐰 Critters, 🍩 Sweets')).toBeInTheDocument();
    expect(screen.getByText('🐰 Critters, 🍩 Sweets').closest('div')).toHaveClass('flex-wrap');
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    expect(screen.getByRole('checkbox', { name: /Critters/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Sweets/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Fantasy/i })).not.toBeChecked();

    // Uncheck both to verify 0 categories is allowed
    fireEvent.click(screen.getByRole('checkbox', { name: /Critters/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Sweets/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    expect(handleSave.mock.calls[0][0][0].categories).toEqual([]);
  });

  it('pre-checks legacy single category product and preserves explicit empty categories array', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    expect(screen.getByText('🐰 Critters')).toBeInTheDocument();

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    expect(screen.getByRole('checkbox', { name: /Critters/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Sweets/i })).not.toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));
    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });
    expect(handleSave.mock.calls[0][0][0].categories).toEqual(['animals']);
    expect(handleSave.mock.calls[0][0][0].category).toBeUndefined();

    // Explicit empty categories array must not fall back to DEFAULT_CATEGORIES
    rerender(<InventoryTab products={mockProducts} categories={[]} onSave={handleSave} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Add New Weeble/i }));
    expect(screen.getByText(/No categories available yet/i)).toBeInTheDocument();
  });

  it('preserves unsaved category toggles while pruning deleted IDs and renders keyboard focus-within styles', () => {
    const initialCategories = [
      { id: 'animals', label: 'Critters', emoji: '🐰' },
      { id: 'sweets', label: 'Sweets', emoji: '🍩' },
      { id: 'fantasy', label: 'Fantasy', emoji: '✨' },
    ];
    const { rerender } = render(
      <InventoryTab products={mockProducts} categories={initialCategories} onSave={vi.fn()} />
    );

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);

    const fantasyCheckbox = screen.getByRole('checkbox', { name: /Fantasy/i });
    const fantasyLabel = fantasyCheckbox.closest('label');
    expect(fantasyLabel).toHaveClass(
      'focus-within:ring-2',
      'focus-within:ring-weeble-pink',
      'focus-within:ring-offset-1'
    );

    // Toggle Fantasy ON (unsaved edit)
    fireEvent.click(fantasyCheckbox);
    expect(fantasyCheckbox).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Critters/i })).toBeChecked();

    // Update categories prop without removing Fantasy or Critters -> unsaved Fantasy toggle is preserved
    rerender(
      <InventoryTab
        products={mockProducts}
        categories={[
          { id: 'animals', label: 'Critters', emoji: '🐰' },
          { id: 'fantasy', label: 'Fantasy', emoji: '✨' },
          { id: 'seasonal', label: 'Seasonal', emoji: '🎃' },
        ]}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole('checkbox', { name: /Fantasy/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Critters/i })).toBeChecked();

    // Remove Fantasy from available categories -> Fantasy is pruned while Critters remains checked
    rerender(
      <InventoryTab
        products={mockProducts}
        categories={[
          { id: 'animals', label: 'Critters', emoji: '🐰' },
          { id: 'seasonal', label: 'Seasonal', emoji: '🎃' },
        ]}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('checkbox', { name: /Fantasy/i })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Critters/i })).toBeChecked();
  });

  it('opens Manage Categories modal and cascades deletion through onSaveCategories', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSaveCategories = vi.fn().mockResolvedValue(undefined);

    render(
      <InventoryTab
        products={mockProducts}
        onSave={vi.fn()}
        onSaveCategories={onSaveCategories}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Manage Categories/i }));
    expect(screen.getByRole('heading', { name: /Manage Categories/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Critters' }));

    await waitFor(() => {
      expect(onSaveCategories).toHaveBeenCalledTimes(1);
    });

    const [updatedCategories, updatedProducts] = onSaveCategories.mock.calls[0];
    expect(updatedCategories.some((c: any) => c.id === 'animals')).toBe(false);
    expect(updatedProducts[0].categories).toEqual([]);
  });

  it('allows editing stock count on a 1-of-1 item and updates inStock and isOneOfAKind accordingly', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[1]); // Edit Berry Sweetie (isOneOfAKind: true, inStock: false, stockCount: 0)

    const stockInput = screen.getByLabelText(/Stock Count/i);
    expect(stockInput).toBeInTheDocument();

    fireEvent.change(stockInput, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    const updatedBerry = savedProducts.find((p: Product) => p.id === 'weeble-strawberry');
    expect(updatedBerry.stockCount).toBe(5);
    expect(updatedBerry.inStock).toBe(true);
    expect(updatedBerry.isOneOfAKind).toBe(false);
  });

  it('marks item out of stock with stockCount 0 when Stock Count is set to 0 or In Stock is unchecked', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<InventoryTab products={mockProducts} onSave={handleSave} />);

    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]); // Edit Chubby Bumblebee (inStock: true, stockCount: 2)

    const stockInput = screen.getByLabelText(/Stock Count/i);
    fireEvent.change(stockInput, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedProducts = handleSave.mock.calls[0][0];
    const updatedBee = savedProducts.find((p: Product) => p.id === 'weeble-bee');
    expect(updatedBee.stockCount).toBe(0);
    expect(updatedBee.inStock).toBe(false);
  });

  it('stamps a createdAt ISO timestamp when adding a new product and preserves createdAt when editing', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const existingCreatedAt = '2026-11-01T10:00:00.000Z';
    const productsWithTimestamp: Product[] = [
      { ...mockProducts[0], createdAt: existingCreatedAt },
      mockProducts[1],
    ];

    render(<InventoryTab products={productsWithTimestamp} onSave={handleSave} />);

    // 1. Add a new product -> should stamp createdAt
    fireEvent.click(screen.getByRole('button', { name: /\+ Add New Weeble/i }));
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Fresh Peach' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Juicy peach charm' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const addedProduct: Product = handleSave.mock.calls[0][0][0];
    expect(addedProduct.createdAt).toBeDefined();
    expect(Number.isNaN(Date.parse(addedProduct.createdAt!))).toBe(false);

    // 2. Edit product with existing createdAt -> should preserve original createdAt
    const editBtns = screen.getAllByRole('button', { name: /Edit/i });
    fireEvent.click(editBtns[0]);
    fireEvent.change(screen.getByDisplayValue('Chubby Bumblebee'), {
      target: { value: 'Updated Bumblebee' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(2);
    });

    const editedWithTimestamp: Product = handleSave.mock.calls[1][0][0];
    expect(editedWithTimestamp.createdAt).toBe(existingCreatedAt);

    // 3. Edit legacy product without createdAt -> should keep createdAt undefined
    fireEvent.click(editBtns[1]);
    fireEvent.change(screen.getByDisplayValue('Berry Sweetie'), {
      target: { value: 'Updated Berry Sweetie' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Weeble/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(3);
    });

    const editedLegacy: Product = handleSave.mock.calls[2][0][1];
    expect(editedLegacy.createdAt).toBeUndefined();
  });
});
