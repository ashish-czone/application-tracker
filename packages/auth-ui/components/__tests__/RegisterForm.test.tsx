import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { RegisterForm } from '../RegisterForm';

describe('RegisterForm', () => {
  it('should show validation errors on empty submit', async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} isLoading={false} />);

    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should show password mismatch error', async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} isLoading={false} />);

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'DifferentPass1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('should show strength meter when typing password', async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} isLoading={false} />);

    await userEvent.type(screen.getByLabelText('Password'), 'Test');

    await waitFor(() => {
      expect(screen.getByText(/password strength/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit without confirmPassword', async () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} isLoading={false} />);

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'StrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'StrongPass1!',
      });
    });
  });

  it('should disable button when isLoading is true', () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} isLoading={true} />);

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('should show error prop', () => {
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} isLoading={false} error="Email already taken" />);

    expect(screen.getByText('Email already taken')).toBeInTheDocument();
  });
});
