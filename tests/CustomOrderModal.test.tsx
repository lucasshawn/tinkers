import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomOrderModal } from '../src/components/CustomOrderModal';

describe('CustomOrderModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders custom order fields when open', () => {
    render(<CustomOrderModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Dream Up Your Custom Weeble/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Describe Your Vision/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reference Photo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Custom Request/i })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<CustomOrderModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when close button (X) is clicked', () => {
    const handleClose = vi.fn();
    render(<CustomOrderModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const handleClose = vi.fn();
    render(<CustomOrderModal isOpen={true} onClose={handleClose} />);

    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<CustomOrderModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders dialog with proper accessibility attributes and fieldset', () => {
    render(<CustomOrderModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: /Dream Up Your Custom Weeble/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'custom-modal-title');

    const fieldset = screen.getByRole('group', { name: /Preferred Finish/i });
    expect(fieldset).toBeInTheDocument();
  });

  it('renders finish radio options with magnet selected by default and allows selecting keychain', () => {
    render(<CustomOrderModal isOpen={true} onClose={vi.fn()} />);

    const magnetRadio = screen.getByRole('radio', { name: /magnet/i }) as HTMLInputElement;
    const keychainRadio = screen.getByRole('radio', { name: /keychain/i }) as HTMLInputElement;
    const figurineRadio = screen.getByRole('radio', { name: /figurine/i }) as HTMLInputElement;

    expect(magnetRadio).toBeInTheDocument();
    expect(keychainRadio).toBeInTheDocument();
    expect(figurineRadio).toBeInTheDocument();

    expect(magnetRadio.checked).toBe(true);
    expect(keychainRadio.checked).toBe(false);
    expect(figurineRadio.checked).toBe(false);

    fireEvent.click(keychainRadio);
    expect(keychainRadio.checked).toBe(true);
    expect(magnetRadio.checked).toBe(false);
  });

  it('includes proper Netlify form attributes and fields', () => {
    const { container } = render(<CustomOrderModal isOpen={true} onClose={vi.fn()} />);

    const form = container.querySelector('form');
    expect(form).toHaveAttribute('name', 'custom-requests');
    expect(form).toHaveAttribute('method', 'POST');
    expect(form).toHaveAttribute('data-netlify', 'true');

    const formNameInput = container.querySelector('input[name="form-name"]') as HTMLInputElement;
    expect(formNameInput).toBeInTheDocument();
    expect(formNameInput.value).toBe('custom-requests');

    const fileInput = screen.getByLabelText(/Reference Photo/i) as HTMLInputElement;
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', 'image/*');
  });

  it('submits form via fetch POST and displays confirmation card', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const handleClose = vi.fn();

    render(<CustomOrderModal isOpen={true} onClose={handleClose} />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: 'Sophie' } });
    fireEvent.change(screen.getByLabelText(/Your Email/i), { target: { value: 'sophie@example.com' } });
    fireEvent.change(screen.getByLabelText(/Describe Your Vision/i), {
      target: { value: 'A cute pink piggy with a bow tie' },
    });

    const submitBtn = screen.getByRole('button', { name: /Send Custom Request/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );

    // Confirmation card is displayed
    expect(await screen.findByText(/Request Sent! 💌/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We will review your idea and email you back/i)
    ).toBeInTheDocument();

    // Clicking "Back to Store 🌸" calls onClose
    const backBtn = screen.getByRole('button', { name: /Back to Store 🌸/i });
    fireEvent.click(backBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('handles offline or failed network gracefully and still shows confirmation', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    render(<CustomOrderModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/Your Email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Describe Your Vision/i), { target: { value: 'Test vision' } });

    fireEvent.click(screen.getByRole('button', { name: /Send Custom Request/i }));

    expect(await screen.findByText(/Request Sent! 💌/i)).toBeInTheDocument();
  });
});
