import { type FormHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Form = forwardRef<HTMLFormElement, FormHTMLAttributes<HTMLFormElement>>(
  ({ className, ...props }, ref) => (
    <form ref={ref} className={cn('space-y-4', className)} noValidate {...props} />
  ),
);
Form.displayName = 'Form';

export { Form };
