export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: 'weak' | 'medium' | 'strong';
  requirements: PasswordRequirement[];
}

export function calculateStrength(password: string): PasswordStrengthResult {
  const requirements: PasswordRequirement[] = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /[0-9]/.test(password) },
    { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const metCount = requirements.filter((r) => r.met).length;

  let score: PasswordStrengthResult['score'];
  if (metCount <= 2) {
    score = 'weak';
  } else if (metCount <= 4) {
    score = 'medium';
  } else {
    score = 'strong';
  }

  return { score, requirements };
}
