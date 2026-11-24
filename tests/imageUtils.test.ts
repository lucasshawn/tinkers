import { describe, it, expect, afterEach } from 'vitest';
import {
  sanitizeImageFilename,
  readAndCompressImage,
  getProductImageFallbackUrl,
  handleProductImageError,
} from '../src/utils/imageUtils';

describe('imageUtils', () => {
  const originalFileReader = window.FileReader;

  afterEach(() => {
    window.FileReader = originalFileReader;
  });

  it('sanitizes filenames by removing spaces and disallowed characters', () => {
    expect(sanitizeImageFilename('sweet strawberry #1 (special).png')).toBe(
      'sweetstrawberry1special.png'
    );
  });

  it('prepends sanitized prefix when provided', () => {
    expect(sanitizeImageFilename('IMG 001.jpg', 'weeble-bee-magnet')).toBe(
      'weeble-bee-magnet-IMG001.jpg'
    );
    expect(sanitizeImageFilename('photo.png', 'weeble bee/keychain')).toBe(
      'weeblebeekeychain-photo.png'
    );
  });

  it('reads a file as data URL and invokes onImmediate with sanitized filename', () => {
    const mockResult = 'data:image/png;base64,ZHVtbXk=';
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

    const file = new File(['dummy'], 'my bee!.png', { type: 'image/png' });
    let captured: { filename: string; base64Data: string } | null = null;

    readAndCompressImage(file, {
      onImmediate: (img) => {
        captured = img;
      },
    });

    expect(captured).toEqual({
      filename: 'mybee.png',
      base64Data: mockResult,
    });
  });

  it('builds a Netlify Blobs fallback URL only for valid /images/products/ paths', () => {
    expect(getProductImageFallbackUrl('/images/products/crunchy.jpg')).toBe(
      '/.netlify/functions/admin-save?action=product-image&name=crunchy.jpg'
    );
    expect(getProductImageFallbackUrl('https://example.com/pic.jpg')).toBeNull();
    expect(getProductImageFallbackUrl('data:image/png;base64,abc')).toBeNull();
    expect(getProductImageFallbackUrl('/images/products/../secret.jpg')).toBeNull();
    expect(getProductImageFallbackUrl('/images/products/evil.svg')).toBeNull();
    expect(getProductImageFallbackUrl(undefined)).toBeNull();
  });

  it('applies product image fallback once per original src and updates if src changes', () => {
    const img = document.createElement('img');
    img.src = '/images/products/crunchy.jpg';

    handleProductImageError({ currentTarget: img } as any, '/images/products/crunchy.jpg');
    expect(img.getAttribute('src')).toBe(
      '/.netlify/functions/admin-save?action=product-image&name=crunchy.jpg'
    );
    expect(img.dataset.fallbackFor).toBe('/images/products/crunchy.jpg');

    // Second error for the same src does not overwrite/loop
    img.setAttribute('src', 'https://already-failed.test/x');
    handleProductImageError({ currentTarget: img } as any, '/images/products/crunchy.jpg');
    expect(img.getAttribute('src')).toBe('https://already-failed.test/x');

    // Switching to another product image src allows fallback for the new src
    handleProductImageError({ currentTarget: img } as any, '/images/products/crunchy-magnet.jpg');
    expect(img.getAttribute('src')).toBe(
      '/.netlify/functions/admin-save?action=product-image&name=crunchy-magnet.jpg'
    );
    expect(img.dataset.fallbackFor).toBe('/images/products/crunchy-magnet.jpg');
  });
});
