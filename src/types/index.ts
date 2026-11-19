export * from './settings';
export * from './changes';

export type VariantType = 'magnet' | 'keychain';

export type VariantPrices = Partial<Record<VariantType, number>>;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  variantPrices?: VariantPrices;
  images: string[];
  categories?: string[];
  category?: string;
  availableVariants: VariantType[];
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isOneOfAKind?: boolean;
  createdAt?: string;
}

export interface CartItem {
  id: string; // composite key: `${productId}-${variant || 'standard'}`
  productId: string;
  name: string;
  variant?: VariantType;
  price: number;
  image: string;
  quantity: number;
  maxQuantity?: number;
}

export interface CustomOrderRequest {
  name: string;
  email: string;
  variantPreference: VariantType | 'both' | 'desk_figurine';
  description: string;
  photoUrl?: string;
}
