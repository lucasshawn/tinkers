import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { MarkdownFieldEditor } from '../src/components/admin/MarkdownFieldEditor';

const ControlledEditor: React.FC<{
  initialValue?: string;
  defaultValue?: string;
  onUploadImage?: (file: File) => Promise<{ url: string; alt: string }>;
}> = ({
  initialValue = 'Hello World',
  defaultValue = 'Default Copy',
  onUploadImage = vi.fn().mockResolvedValue({ url: '/images/content/star.png', alt: 'star' }),
}) => {
  const [val, setVal] = useState(initialValue);
  return (
    <MarkdownFieldEditor
      id="testField"
      label="Hero Title"
      value={val}
      defaultValue={defaultValue}
      previewVariant="heroTitle"
      onChange={setVal}
      onUploadImage={onUploadImage}
    />
  );
};

describe('MarkdownFieldEditor', () => {
  it('wraps selected text with bold, italic, wavy highlight, font, and color toolbar actions', () => {
    render(<ControlledEditor initialValue="Hello World" />);
    const textarea = screen.getByLabelText('Hero Title') as HTMLTextAreaElement;

    // Select "World" -> Bold
    textarea.setSelectionRange(6, 11);
    fireEvent.click(screen.getByRole('button', { name: /Bold Hero Title/i }));
    expect(textarea.value).toBe('Hello **World**');

    // Reset and test Italic
    fireEvent.change(textarea, { target: { value: 'Hello World' } });
    textarea.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole('button', { name: /Italic Hero Title/i }));
    expect(textarea.value).toBe('*Hello* World');

    // Reset and test Wavy
    fireEvent.change(textarea, { target: { value: 'Fridge & Keys' } });
    textarea.setSelectionRange(0, 13);
    fireEvent.click(screen.getByRole('button', { name: /Wavy Highlight Hero Title/i }));
    expect(textarea.value).toBe('[Fridge & Keys]{color=pink wavy}');

    // Test Font dropdown
    fireEvent.change(textarea, { target: { value: 'Cute' } });
    textarea.setSelectionRange(0, 4);
    fireEvent.change(screen.getByLabelText(/Insert font for Hero Title/i), {
      target: { value: 'serif' },
    });
    expect(textarea.value).toBe('[Cute]{font=serif}');

    // Test Color swatch picker
    fireEvent.change(textarea, { target: { value: 'Pastel' } });
    textarea.setSelectionRange(0, 6);
    fireEvent.click(screen.getByRole('button', { name: /Color Hero Title/i }));
    fireEvent.click(screen.getByRole('button', { name: /Apply Lilac color/i }));
    expect(textarea.value).toBe('[Pastel]{color=lilac}');
  });

  it('uploads an inline PNG and inserts Markdown image syntax into the field', async () => {
    const uploadMock = vi
      .fn()
      .mockResolvedValue({ url: '/images/content/sparkle-123.png', alt: 'sparkle' });
    render(<ControlledEditor initialValue="Hi " onUploadImage={uploadMock} />);

    const fileInput = screen.getByLabelText(/Upload inline PNG for Hero Title/i) as HTMLInputElement;
    const file = new File(['png-bytes'], 'sparkle.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith(file);
    });
    const textarea = screen.getByLabelText('Hero Title') as HTMLTextAreaElement;
    expect(textarea.value).toContain('![sparkle](/images/content/sparkle-123.png)');
  });

  it('rejects unsupported file types and oversized images before calling onUploadImage', async () => {
    const uploadMock = vi.fn();
    render(<ControlledEditor initialValue="Hi " onUploadImage={uploadMock} />);

    const fileInput = screen.getByLabelText(/Upload inline PNG for Hero Title/i) as HTMLInputElement;

    const svgFile = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' });
    fireEvent.change(fileInput, { target: { files: [svgFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/PNG, JPG, WEBP, or GIF/i);
    expect(uploadMock).not.toHaveBeenCalled();

    const bigFile = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'huge.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 MB or smaller/i);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('renders live preview and resets value back to defaultValue', () => {
    render(<ControlledEditor initialValue="**Live** Preview" defaultValue="Default Copy" />);

    expect(screen.getByText('Live').tagName).toBe('STRONG');

    fireEvent.click(screen.getByRole('button', { name: /Reset to default/i }));
    expect((screen.getByLabelText('Hero Title') as HTMLTextAreaElement).value).toBe('Default Copy');
  });
});
