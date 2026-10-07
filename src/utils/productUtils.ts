import { Product } from '../types';

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function filterProducts(products: Product[], category: string, searchQuery: string): Product[] {
  const query = searchQuery.trim().toLowerCase();

  return products.filter((product) => {
    // Category match
    let matchesCategory = true;
    if (category === 'all') {
      matchesCategory = true;
    } else if (category === 'magnets') {
      matchesCategory = product.availableVariants.includes('magnet');
    } else if (category === 'keychains') {
      matchesCategory = product.availableVariants.includes('keychain');
    } else if (category === 'under-15') {
      matchesCategory = product.price < 15.0;
    } else if (category === 'featured') {
      matchesCategory = Boolean(product.featured);
    } else {
      matchesCategory = product.category === category;
    }

    // Search query match
    let matchesQuery = true;
    if (query) {
      matchesQuery =
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);
    }

    return matchesCategory && matchesQuery;
  });
}
