import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ResetPasswordForm } from '../ResetPasswordForm';

describe('ResetPasswordForm', () => {
  it('should show validation errors on empty submit', async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm onSubmit={onSubmit} isLoading={false} isSuccess={false} />);

    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should show password mismatch error', async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm onSubmit={onSubmit} isLoading={false} isSuccess={false} />);

    await userEvent.type(screen.getByLabelText('New password'), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'DifferentPass1!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should show strength meter when typing password', async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm onSubmit={onSubmit} isLoading={false} isSuccess={false} />);

    await userEvent.type(screen.getByLabelText('New password'), 'Test');

    await waitFor(() => {
      expect(screen.getByText(/password strength/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit with password only', async () => {
    const onSubmit = vi.fn();
    render(<ResetPasswordForm onSubmit={onSubmit} isLoading={false} isSuccess={false} />);

    await userEvent.type(screen.getByLabelText('New password'), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'StrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ password: 'StrongPass1!' });
    });
  });
});
