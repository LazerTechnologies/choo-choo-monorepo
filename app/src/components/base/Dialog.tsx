'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import * as React from 'react';
import { cva, VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const overlayVariants = cva(
  'fixed bg-overlay data-[state=open]:fade-in-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
  {
    variants: {
      variant: {
        default: 'inset-0 z-50',
        none: 'fixed bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type IDialogBackdropProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof overlayVariants>;

const DialogBackdrop = React.forwardRef<HTMLDivElement, IDialogBackdropProps>(
  function DialogBackdrop(inputProps: IDialogBackdropProps, forwardedRef) {
    const { variant = 'default', className, ...props } = inputProps;

    return (
      <DialogPrimitive.Overlay
        className={cn(overlayVariants({ variant }), className)}
        ref={forwardedRef}
        {...props}
      />
    );
  }
);
DialogBackdrop.displayName = 'DialogBackdrop';

const dialogVariants = cva(
  'fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] flex flex-col border-2 border-border dark:border-darkBorder bg-bg dark:bg-darkBg shadow-light dark:shadow-dark gap-4 overflow-y-auto w-full h-fit max-h-[80vh] max-w-[97%] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-base',
  {
    variants: {
      size: {
        auto: 'max-w-fit',
        sm: 'lg:max-w-[30%]',
        md: 'lg:max-w-[40%]',
        lg: 'lg:max-w-[50%]',
        xl: 'lg:max-w-[60%]',
        '2xl': 'lg:max-w-[70%]',
        '3xl': 'lg:max-w-[80%]',
        '4xl': 'lg:max-w-[90%]',
        screen: 'max-w-[100%]',
      },
    },
    defaultVariants: {
      size: 'auto',
    },
  }
);

interface IDialogContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dialogVariants> {
  overlay?: IDialogBackdropProps;
  title?: string;
  description?: string;
}

const DialogContent = React.forwardRef<HTMLDivElement, IDialogContentProps>(function DialogContent(
  inputProps: IDialogContentProps,
  forwardedRef
) {
  const { children, size = 'auto', className, overlay, title, description, ...props } = inputProps;

  return (
    <DialogPortal>
      <DialogBackdrop {...overlay} />
      <DialogPrimitive.Content
        className={cn(dialogVariants({ size }), className)}
        ref={forwardedRef}
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        {...props}
      >
        <DialogPrimitive.Title id="dialog-title">
          <VisuallyHidden>{title || 'Dialog'}</VisuallyHidden>
        </DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description id="dialog-description">
            <VisuallyHidden>{description}</VisuallyHidden>
          </DialogPrimitive.Description>
        )}
        <div className="flex flex-col relative">{children}</div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-100 ring-offset-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-white data-[state=open]:text-white">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const dialogHeaderVariants = cva('flex items-center justify-between border-b-2 px-4 min-h-12', {
  variants: {
    variant: {
      default: 'bg-primary text-black',
    },
    position: {
      fixed: 'sticky top-0',
      static: 'static',
    },
  },
  defaultVariants: {
    variant: 'default',
    position: 'static',
  },
});

const DialogHeaderDefaultLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <DialogPrimitive.Close title="Close pop-up" className="cursor-pointer" asChild>
        <X />
      </DialogPrimitive.Close>
    </>
  );
};

type IDialogHeaderProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof dialogHeaderVariants> &
  DialogPrimitive.DialogTitleProps;

const DialogHeader = ({
  children,
  className,
  position,
  variant,
  asChild,
  ...props
}: IDialogHeaderProps) => {
  return (
    <div className={cn(dialogHeaderVariants({ position, variant }), className)} {...props}>
      {asChild ? children : <DialogHeaderDefaultLayout>{children}</DialogHeaderDefaultLayout>}
    </div>
  );
};

const dialogFooterVariants = cva(
  'flex items-center justify-end border-t-2 min-h-12 gap-4 px-4 py-2',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
      },
      position: {
        fixed: 'sticky bottom-0',
        static: 'static',
      },
    },
    defaultVariants: {
      position: 'fixed',
    },
  }
);

export type IDialogFooterProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof dialogFooterVariants>;

const DialogFooter = ({ children, className, position, variant, ...props }: IDialogFooterProps) => {
  return (
    <div className={cn(dialogFooterVariants({ position, variant }), className)} {...props}>
      {children}
    </div>
  );
};

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-heading leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm font-base text-text dark:text-darkText', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogComponent = Object.assign(Dialog, {
  Trigger: DialogTrigger,
  Header: DialogHeader,
  Content: DialogContent,
  Description: DialogDescription,
  Footer: DialogFooter,
});

export { DialogComponent as Dialog };
