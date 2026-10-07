export type VariantType = 'magnet' | 'keychain';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: 'animals' | 'sweets' | 'fantasy' | 'mini-friends';
  availableVariants: VariantType[];
  inStock: boolean;
  stockCount: number;
  featured?: boolean;
  isOneOfAKind?: boolean;
}

export interface CartItem {
  id: string; // composite key: `${productId}-${variant}`
  productId: string;
  name: string;
  variant: VariantType;
  price: number;
  image: string;
  quantity: number;
}

export interface CustomOrderRequest {
  name: string;
  email: string;
  variantPreference: VariantType | 'both' | 'desk_figurine';
  description: string;
  photoUrl?: string;
}
