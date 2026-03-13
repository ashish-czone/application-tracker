import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  it('should show validation errors on empty submit', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isLoading={false} />);

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should show email format error on blur', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isLoading={false} />);

    const emailInput = screen.getByLabelText('Email');
    await userEvent.type(emailInput, 'not-an-email');
    await userEvent.tab();

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit with valid data', async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isLoading={false} />);

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { email: 'user@example.com', password: 'password123' },
        expect.anything(),
      );
    });
  });

  it('should disable button when isLoading is true', () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isLoading={true} />);

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('should show error prop', () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error="Invalid credentials" />);

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });
});
