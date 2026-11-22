import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  ImagePlus,
  RotateCcw,
  Sparkles,
  Palette,
  Loader2,
} from 'lucide-react';
import { RichMarkdown } from '../RichMarkdown';

export interface MarkdownFieldEditorProps {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  mode?: 'inline' | 'block';
  rows?: number;
  previewVariant?: 'pill' | 'heroTitle' | 'heading' | 'subtitle' | 'careList';
  onChange: (nextValue: string) => void;
  onUploadImage: (file: File) => Promise<{ url: string; alt: string }>;
}

const COLOR_SWATCHES = [
  { name: 'pink', hex: '#FF85A1', label: 'Weeble Pink' },
  { name: 'rose', hex: '#F43F5E', label: 'Rose' },
  { name: 'lilac', hex: '#A78BFA', label: 'Lilac' },
  { name: 'blue', hex: '#38BDF8', label: 'Sky Blue' },
  { name: 'mint', hex: '#34D399', label: 'Mint' },
  { name: 'yellow', hex: '#EAB308', label: 'Honey Gold' },
  { name: 'text', hex: '#4A2E35', label: 'Cocoa' },
  { name: 'textMuted', hex: '#7A5C61', label: 'Muted' },
];

const MAX_CLIENT_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;

export const MarkdownFieldEditor: React.FC<MarkdownFieldEditorProps> = ({
  id,
  label,
  value,
  defaultValue,
  mode = 'inline',
  rows = 2,
  previewVariant = 'subtitle',
  onChange,
  onUploadImage,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [customHex, setCustomHex] = useState('#FF85A1');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(nextValue);

    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const cursorStart = start + before.length;
        el.setSelectionRange(cursorStart, cursorStart + selected.length);
      }
    });
  };

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const nextValue = value.slice(0, start) + snippet + value.slice(end);
    onChange(nextValue);

    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const cursor = start + snippet.length;
        el.setSelectionRange(cursor, cursor);
      }
    });
  };

  const handleApplyColor = (colorValue: string) => {
    wrapSelection('[', `]{color=${colorValue}}`, 'colored text');
    setShowColorMenu(false);
  };

  const handleFontSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const font = e.target.value;
    if (!font) return;
    wrapSelection('[', `]{font=${font}}`, 'styled text');
    e.target.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    const mimeAllowed = file.type ? ALLOWED_MIME_TYPES.has(file.type.toLowerCase()) : ALLOWED_EXT_RE.test(file.name);
    if (!mimeAllowed) {
      setUploadError('Please choose a PNG, JPG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_CLIENT_IMAGE_BYTES) {
      setUploadError('Image must be 2 MB or smaller.');
      return;
    }

    setIsUploading(true);
    try {
      const { url, alt } = await onUploadImage(file);
      insertAtCursor(`![${alt}](${url})`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload image.';
      setUploadError(message || 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderPreview = () => {
    if (!value.trim()) {
      return <span className="italic text-neutral-400 text-xs">(hidden when empty)</span>;
    }
    switch (previewVariant) {
      case 'pill':
        return (
          <div className="inline-flex items-center gap-1.5 bg-white border border-pink-200 text-weeble-text font-bold px-3 py-1 rounded-full text-xs">
            <Sparkles className="w-3.5 h-3.5 text-weeble-pink" />
            <span>
              <RichMarkdown content={value} mode="inline" />
            </span>
          </div>
        );
      case 'heroTitle':
        return (
          <div className="font-bubble text-xl sm:text-2xl font-bold text-weeble-text leading-tight">
            <RichMarkdown content={value} mode="inline" />
          </div>
        );
      case 'heading':
        return (
          <div className="font-bubble text-lg font-bold text-weeble-text">
            <RichMarkdown content={value} mode="inline" />
          </div>
        );
      case 'careList':
        return (
          <RichMarkdown
            content={value}
            mode="block"
            className="text-xs text-weeble-textMuted space-y-1.5"
          />
        );
      case 'subtitle':
      default:
        return (
          <div className="text-xs sm:text-sm text-weeble-textMuted leading-relaxed">
            <RichMarkdown content={value} mode={mode} />
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-bold text-weeble-text">
          {label}
        </label>
        {value !== defaultValue && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            title={`Reset ${label} to default`}
            className="text-[11px] font-bold text-weeble-pink hover:text-pink-600 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to default</span>
          </button>
        )}
      </div>

      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-pink-50/70 border border-pink-200 rounded-xl px-2 py-1.5 relative">
        <button
          type="button"
          onClick={() => wrapSelection('**', '**', 'bold text')}
          aria-label={`Bold ${label}`}
          title="Bold (**text**)"
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
        >
          <Bold className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Bold</span>
        </button>

        <button
          type="button"
          onClick={() => wrapSelection('*', '*', 'italic text')}
          aria-label={`Italic ${label}`}
          title="Italic (*text*)"
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
        >
          <Italic className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Italic</span>
        </button>

        <button
          type="button"
          onClick={() => wrapSelection('[', ']{color=pink wavy}', 'highlight')}
          aria-label={`Wavy Highlight ${label}`}
          title="Pink wavy underline ([text]{color=pink wavy})"
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-pink bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Wavy</span>
        </button>

        {/* Color Swatch Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorMenu((prev) => !prev)}
            aria-label={`Color ${label}`}
            aria-expanded={showColorMenu}
            title="Text color ([text]{color=...})"
            className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-weeble-pink" />
            <span>Color</span>
          </button>

          {showColorMenu && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border-2 border-pink-200 rounded-2xl p-2.5 shadow-lg w-52 space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.name}
                    type="button"
                    title={swatch.label}
                    aria-label={`Apply ${swatch.label} color`}
                    onClick={() => handleApplyColor(swatch.name)}
                    className="w-8 h-8 rounded-lg border border-pink-200 hover:scale-110 transition-transform cursor-pointer"
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-pink-100">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  aria-label={`Custom color for ${label}`}
                  className="w-7 h-7 rounded cursor-pointer border border-pink-200"
                />
                <button
                  type="button"
                  onClick={() => handleApplyColor(customHex)}
                  className="flex-1 text-[11px] font-bold bg-weeble-pink text-white px-2 py-1 rounded-lg hover:bg-pink-500 cursor-pointer"
                >
                  Apply {customHex}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Font Picker */}
        <select
          aria-label={`Insert font for ${label}`}
          defaultValue=""
          onChange={handleFontSelect}
          className="text-xs font-semibold text-weeble-text bg-white border border-pink-200 rounded-lg px-2 py-1 focus:outline-none focus:border-weeble-pink cursor-pointer"
        >
          <option value="">Font…</option>
          <option value="bubble">Fredoka (Bubble)</option>
          <option value="body">Quicksand (Body)</option>
          <option value="serif">Serif (Georgia)</option>
          <option value="mono">Monospace</option>
        </select>

        {/* Upload Inline PNG */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label={`Upload inline PNG for ${label}`}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 rounded-lg text-xs font-bold text-weeble-text bg-white border border-pink-200 hover:border-weeble-pink flex items-center gap-1 disabled:opacity-50 cursor-pointer"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-weeble-pink" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5 text-weeble-pink" />
          )}
          <span>{isUploading ? 'Uploading…' : 'Insert PNG'}</span>
        </button>
      </div>

      {uploadError && (
        <p role="alert" className="text-[11px] font-bold text-rose-600">
          {uploadError}
        </p>
      )}

      <textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm font-mono bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
      />

      <div className="bg-weeble-pinkBg/70 border border-pink-100 rounded-xl px-3.5 py-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
          Live Preview
        </div>
        {renderPreview()}
      </div>
    </div>
  );
};
