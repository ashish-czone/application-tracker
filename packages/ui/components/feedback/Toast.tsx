import { Toaster as SonnerToaster, toast } from 'sonner';

/**
 * Toast provider — render once at the app root (e.g., in providers.tsx).
 * Styled to match the app's design tokens.
 */
function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      richColors
      toastOptions={{
        classNames: {
          title: 'text-sm font-medium',
          description: 'text-sm',
        },
      }}
    />
  );
}

export { Toaster, toast };
