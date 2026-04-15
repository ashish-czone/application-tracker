import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SheetContextValue {
  modal: boolean;
}
const SheetContext = React.createContext<SheetContextValue>({ modal: true });

interface SheetProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  /**
   * When false, the sheet renders without an overlay and does not trap
   * focus or block interaction with the page behind it — useful for
   * inline detail panels that coexist with the main workspace.
   * Defaults to true (classic modal sheet).
   */
  modal?: boolean;
}

const Sheet = ({ modal = true, ...props }: SheetProps) => (
  <SheetContext.Provider value={{ modal }}>
    <DialogPrimitive.Root modal={modal} {...props} />
  </SheetContext.Provider>
);
Sheet.displayName = 'Sheet';

const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="sheet-overlay"
    className={cn('fixed inset-0 z-40 bg-black/60 sheet-overlay', className)}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

interface SheetContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: 'left' | 'right';
}

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = 'right', ...props }, ref) => {
  const { modal } = React.useContext(SheetContext);
  return (
    <SheetPortal>
      {modal && <SheetOverlay />}
      <DialogPrimitive.Content
        ref={ref}
        data-slot="sheet-content"
        data-side={side}
        data-modal={modal ? 'true' : 'false'}
        onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
        onPointerDownOutside={modal ? undefined : (e) => e.preventDefault()}
        className={cn(
          'fixed z-50 flex flex-col bg-background shadow-lg sheet-content',
          side === 'right' && 'inset-y-0 right-0 h-full w-3/4 max-w-2xl border-l sheet-slide-right',
          side === 'left' && 'inset-y-0 left-0 h-full w-3/4 max-w-2xl border-r sheet-slide-left',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          data-slot="sheet-close"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 px-6 py-4 border-b', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex items-center justify-end gap-2 px-6 py-4 border-t mt-auto', className)}
    {...props}
  />
);
SheetFooter.displayName = 'SheetFooter';

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="sheet-title"
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  type SheetProps,
};
