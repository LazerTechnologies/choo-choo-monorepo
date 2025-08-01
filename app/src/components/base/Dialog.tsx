'use client';

import * as ReactDialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';
import React, { HTMLAttributes, ReactNode } from 'react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';

const Dialog = ReactDialog.Root;
const DialogTrigger = ReactDialog.Trigger;

const overlayVariants = cva(
  ` fixed bg-black/80 font-head
    data-[state=open]:fade-in-0
    data-[state=open]:animate-in 
    data-[state=closed]:animate-out 
    data-[state=closed]:fade-out-0 
  `,
  {
    variants: {
      variant: {
        default: 'inset-0 z-50 bg-black/80',
        none: 'fixed bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type IDialogBackdropProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof overlayVariants>;

const DialogBackdrop = React.forwardRef<HTMLDivElement, IDialogBackdropProps>(
  function DialogBackdrop(inputProps: IDialogBackdropProps, forwardedRef) {
    const { variant = 'default', className, ...props } = inputProps;

    return (
      <ReactDialog.Overlay
        className={cn(overlayVariants({ variant }), className)}
        ref={forwardedRef}
        {...props}
      />
    );
  }
);
DialogBackdrop.displayName = 'DialogBackdrop';

const dialogVariants = cva(
  `fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
  flex flex-col border-2 shadow-md gap-4 overflow-y-auto bg-background text-foreground
  w-full h-fit max-h-[80vh] max-w-[97%] duration-300
  data-[state=open]:animate-in 
  data-[state=open]:slide-in-from-left-1/2 
  data-[state=open]:slide-in-from-top-[48%]
  data-[state=open]:fade-in-0 
  data-[state=open]:zoom-in-95 
  data-[state=closed]:animate-out 
  data-[state=closed]:fade-out-0 
  data-[state=closed]:slide-out-to-top-[48%] 
  data-[state=closed]:slide-out-to-left-1/2 
  data-[state=closed]:zoom-out-95`,
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
  extends HTMLAttributes<HTMLDivElement>,
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
    <ReactDialog.Portal>
      <DialogBackdrop {...overlay} />
      <ReactDialog.Content
        className={cn(dialogVariants({ size }), className)}
        ref={forwardedRef}
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? 'dialog-description' : undefined}
        {...props}
      >
        <ReactDialog.Title id="dialog-title">
          <VisuallyHidden>{title || 'Dialog'}</VisuallyHidden>
        </ReactDialog.Title>
        {description && (
          <ReactDialog.Description id="dialog-description">
            <VisuallyHidden>{description}</VisuallyHidden>
          </ReactDialog.Description>
        )}
        <div className="flex flex-col relative">{children}</div>
      </ReactDialog.Content>
    </ReactDialog.Portal>
  );
});
DialogContent.displayName = 'DialogContent';

type IDialogDescriptionProps = HTMLAttributes<HTMLDivElement>;
const DialogDescription = ({ children, className, ...props }: IDialogDescriptionProps) => {
  return (
    <ReactDialog.Description className={cn(className)} {...props}>
      {children}
    </ReactDialog.Description>
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

export type IDialogFooterProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof dialogFooterVariants>;

const DialogFooter = ({ children, className, position, variant, ...props }: IDialogFooterProps) => {
  return (
    <div className={cn(dialogFooterVariants({ position, variant }), className)} {...props}>
      {children}
    </div>
  );
};

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

const DialogHeaderDefaultLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {children}
      <ReactDialog.Close title="Close pop-up" className="cursor-pointer" asChild>
        <X />
      </ReactDialog.Close>
    </>
  );
};

type IDialogHeaderProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof dialogHeaderVariants> &
  ReactDialog.DialogTitleProps;

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

const DialogComponent = Object.assign(Dialog, {
  Trigger: DialogTrigger,
  Header: DialogHeader,
  Content: DialogContent,
  Description: DialogDescription,
  Footer: DialogFooter,
});

export { DialogComponent as Dialog };
