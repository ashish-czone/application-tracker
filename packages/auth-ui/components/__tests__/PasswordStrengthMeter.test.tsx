import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PasswordStrengthMeter } from '../PasswordStrengthMeter';

describe('PasswordStrengthMeter', () => {
  it('should show all requirements as unmet for empty password', () => {
    render(<PasswordStrengthMeter password="" />);

    expect(screen.getByText('weak')).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
    expect(screen.getByText('One number')).toBeInTheDocument();
    expect(screen.getByText('One special character')).toBeInTheDocument();
  });

  it('should show weak for password meeting 1-2 requirements', () => {
    render(<PasswordStrengthMeter password="abc" />);

    expect(screen.getByText('weak')).toBeInTheDocument();
  });

  it('should show medium for password meeting 3-4 requirements', () => {
    render(<PasswordStrengthMeter password="Abcdefgh1" />);

    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('should show strong for password meeting all 5 requirements', () => {
    render(<PasswordStrengthMeter password="Abcdefg1!" />);

    expect(screen.getByText('strong')).toBeInTheDocument();
  });
});
