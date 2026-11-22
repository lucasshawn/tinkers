import { describe, it, expect, afterEach } from 'vitest';
import { sanitizeImageFilename, readAndCompressImage } from '../src/utils/imageUtils';

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
});
