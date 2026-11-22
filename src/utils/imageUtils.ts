import { UploadedImage } from '../types';

export function sanitizeImageFilename(rawFilename: string, prefix?: string): string {
  const baseName = rawFilename.split(/[/\\]/).pop() || rawFilename;
  const cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!prefix) return cleanName;
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9._-]/g, '');
  return cleanPrefix ? `${cleanPrefix}-${cleanName}` : cleanName;
}

export interface ReadAndCompressOptions {
  onImmediate: (img: UploadedImage) => void;
  onCompressed?: (img: UploadedImage) => void;
}

export function readAndCompressImage(file: File, options: ReadAndCompressOptions): void {
  const cleanFilename = sanitizeImageFilename(file.name);
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result as string;
    const immediateImg: UploadedImage = { filename: cleanFilename, base64Data: base64 };
    options.onImmediate(immediateImg);

    // Compress large photos (> 200KB) via canvas to stay well under serverless and localStorage limits.
    if (base64.length > 200_000 && typeof Image !== 'undefined' && typeof document !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            if (compressed && compressed.startsWith('data:image/')) {
              const compressedImg: UploadedImage = {
                filename: cleanFilename,
                base64Data: compressed,
              };
              (options.onCompressed || options.onImmediate)(compressedImg);
            }
          }
        } catch {
          // Keep original base64 if canvas compression is unavailable
        }
      };
      img.src = base64;
    }
  };
  reader.readAsDataURL(file);
}
