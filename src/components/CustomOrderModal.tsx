import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, CheckCircle2 } from 'lucide-react';

export interface CustomOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomOrderModal: React.FC<CustomOrderModalProps> = ({ isOpen, onClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      // Netlify Form submission via standard POST with multipart/form-data support
      await fetch('/', {
        method: 'POST',
        body: formData,
      });
    } catch {
      // Fallback grace for offline/dev preview
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
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

            <form
              name="custom-requests"
              method="POST"
              data-netlify="true"
              encType="multipart/form-data"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <input type="hidden" name="form-name" value="custom-requests" />

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
                  Reference Photo (Optional) 📷
                </label>
                <input
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
                className="w-full bg-weeble-pink hover:bg-pink-500 text-white font-bubble text-base font-bold py-3 px-6 rounded-full shadow-pillow hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending Request...' : 'Send Custom Request 💌'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
