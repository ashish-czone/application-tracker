import { Toaster as SonnerToaster, toast } from 'sonner';

/**
 * Toast provider — render once at the app root (e.g., in providers.tsx).
 * Styled to match the app's design tokens.
 */
function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'bg-background text-foreground border-border shadow-lg',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
          success: 'border-success/30 [&_[data-icon]]:text-success',
          error: 'border-destructive/30 [&_[data-icon]]:text-destructive',
        },
      }}
    />
  );
}

export { Toaster, toast };
