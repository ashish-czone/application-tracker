import { type FormHTMLAttributes } from 'react';
import { FormProvider, type UseFormReturn, type FieldValues } from 'react-hook-form';
import { cn } from '../../lib/utils';

interface FormProps<T extends FieldValues> extends Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  form: UseFormReturn<T>;
  onSubmit: (e?: React.BaseSyntheticEvent) => void | Promise<void>;
}

function Form<T extends FieldValues>({ form, onSubmit, className, children, ...props }: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className={cn('space-y-4', className)} noValidate {...props}>
        {children}
      </form>
    </FormProvider>
  );
}

export { Form, type FormProps };
