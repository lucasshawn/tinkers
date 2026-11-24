import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

const MAX_REFERENCE_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error('Unable to read reference photo file.'));
    reader.readAsDataURL(file);
  });
}

export interface CustomOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomOrderModal: React.FC<CustomOrderModalProps> = ({ isOpen, onClose }) => {
  const { settings } = useSettings();
  const customOrderEmail = settings?.customOrderEmail || 'weeblesclay@gmail.com';
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const finish = String(formData.get('finish') || 'magnet').trim();
    const description = String(formData.get('description') || '').trim();
    const photoEntry = fileInputRef.current?.files?.[0] ?? formData.get('reference_photo');

    try {
      let referencePhoto:
        | { filename: string; contentType: string; base64: string }
        | undefined;

      if (photoEntry instanceof File && photoEntry.size > 0) {
        if (photoEntry.size > MAX_REFERENCE_PHOTO_BYTES) {
          setErrorMessage('Reference photo must be 4 MB or smaller.');
          return;
        }
        const base64 = await readFileAsBase64(photoEntry);
        referencePhoto = {
          filename: photoEntry.name,
          contentType: photoEntry.type || 'image/jpeg',
          base64,
        };
      }

      // Send admin notification email via Netlify Function
      const response = await fetch('/.netlify/functions/custom-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          finish,
          description,
          ...(referencePhoto ? { referencePhoto } : {}),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error ||
            `Unable to send your request right now. Please try again or email ${customOrderEmail}.`
        );
      }

      // Keep Netlify Forms submission as a non-blocking backup log
      fetch('/', {
        method: 'POST',
        body: formData,
      }).catch(() => {});

      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          `Unable to send your request right now. Please try again or email ${customOrderEmail}.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        data-testid="modal-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-modal-title"
        className="relative bg-white rounded-3xl border-4 border-pink-200 max-w-lg w-full p-6 sm:p-8 shadow-2xl z-10"
      >
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-weeble-pinkWash text-weeble-text hover:text-weeble-pink flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-weeble-pink mx-auto mb-4" />
            <h3 className="font-bubble text-3xl font-bold text-weeble-text mb-2">
              Request Sent! 💌
            </h3>
            <p className="text-sm text-weeble-textMuted mb-6 leading-relaxed">
              Yay! Thank you for dreaming up a Weeble with us! We will review your idea and email you back at your address within 24–48 hours with a quote and timeline!
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setErrorMessage(null);
                onClose();
              }}
              className="bg-weeble-pink text-white font-bubble font-bold px-6 py-2.5 rounded-full shadow-pillow hover:scale-105 transition-transform"
            >
              Back to Store 🌸
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <span className="bg-pink-100 text-pink-700 text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3" /> Bespoke Clay Art
              </span>
              <h2
                id="custom-modal-title"
                className="font-bubble text-2xl sm:text-3xl font-bold text-weeble-text"
              >
                Dream Up Your Custom Weeble 💌
              </h2>
              <p className="text-xs text-weeble-textMuted mt-1">
                Have a favorite pet, character, or sweet idea? Tell us what you want sculpted!
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mb-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-700"
              >
                {errorMessage}
              </div>
            )}

            <form
              name="custom-requests"
              method="POST"
              data-netlify="true"
              encType="multipart/form-data"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <input type="hidden" name="form-name" value="custom-requests" />
              <input type="hidden" name="customOrderEmail" value={customOrderEmail} />

              <div>
                <label htmlFor="name" className="block text-xs font-bold text-weeble-text mb-1">
                  Your Name *
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Sophie"
                  className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-bold text-weeble-text mb-1">
                  Your Email * (where we send your quote)
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  placeholder="sophie@gmail.com"
                  className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2.5 text-weeble-text focus:outline-none focus:border-weeble-pink"
                />
              </div>

              <fieldset>
                <legend className="text-xs font-bold text-weeble-text mb-1">
                  Preferred Finish
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs font-bold p-2 border border-pink-200 rounded-xl text-center cursor-pointer bg-white hover:bg-weeble-pinkWash flex items-center justify-center gap-1">
                    <input type="radio" name="finish" value="magnet" defaultChecked className="accent-pink-500" />
                    <span>🧲 Magnet</span>
                  </label>
                  <label className="text-xs font-bold p-2 border border-pink-200 rounded-xl text-center cursor-pointer bg-white hover:bg-weeble-pinkWash flex items-center justify-center gap-1">
                    <input type="radio" name="finish" value="keychain" className="accent-pink-500" />
                    <span>🔑 Keychain</span>
                  </label>
                  <label className="text-xs font-bold p-2 border border-pink-200 rounded-xl text-center cursor-pointer bg-white hover:bg-weeble-pinkWash flex items-center justify-center gap-1">
                    <input type="radio" name="finish" value="figurine" className="accent-pink-500" />
                    <span>🧸 Figurine</span>
                  </label>
                </div>
              </fieldset>

              <div>
                <label htmlFor="description" className="block text-xs font-bold text-weeble-text mb-1">
                  Describe Your Vision *
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  placeholder="Describe your figurine (colors, expressions, cute accessories like bows or boba cups)..."
                  className="w-full text-sm bg-weeble-pinkWash border border-pink-200 rounded-xl px-3.5 py-2 text-weeble-text focus:outline-none focus:border-weeble-pink"
                />
              </div>

              <div>
                <label htmlFor="reference_photo" className="block text-xs font-bold text-weeble-text mb-1">
                  Reference Photo (Optional, max 4 MB) 📷
                </label>
                <input
                  ref={fileInputRef}
                  id="reference_photo"
                  type="file"
                  name="reference_photo"
                  accept="image/*"
                  className="w-full text-xs text-weeble-textMuted file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-weeble-pink file:text-white hover:file:bg-pink-600 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-base font-bold py-3 px-6 rounded-full shadow-pillow hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending Request...' : 'Send Custom Request 💌'}</span>
              </button>

              <p className="text-center text-xs text-weeble-textMuted mt-3">
                Prefer direct email? Reach us at{' '}
                <a href={`mailto:${customOrderEmail}`} className="font-bold text-weeble-pink hover:underline">
                  {customOrderEmail}
                </a>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
