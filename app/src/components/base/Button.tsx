import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';
import React, { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

const buttonVariants = cva(
  'font-head transition-all outline-none cursor-pointer duration-200 font-medium flex items-center justify-center',
  {
    variants: {
      variant: {
        default:
          'shadow-md hover:shadow-none bg-primary text-black border-2 border-black transition hover:translate-y-1 hover:bg-primary-hover',
        secondary:
          'shadow-md hover:shadow-none bg-secondary shadow-primary text-secondary-foreground border-2 border-black transition hover:translate-y-1',
        outline:
          'shadow-md hover:shadow-none bg-transparent border-2 transition hover:translate-y-1',
        link: 'bg-transparent hover:underline',
      },
      size: {
        sm: 'px-3 py-1 text-sm shadow hover:shadow-none',
        md: 'px-4 py-1.5 text-base',
        lg: 'px-8 py-3 text-lg',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
);

export interface IButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, IButtonProps>(
  (
    {
      children,
      size = 'md',
      className = '',
      variant = 'default',
      isLoading = false,
      ...props
    }: IButtonProps,
    forwardedRef
  ) => {
    const isLoadingState = isLoading;
    const buttonClass = cn(
      buttonVariants({ variant, size: isLoadingState ? 'icon' : size }),
      className
    );
    return (
      <button
        ref={forwardedRef}
        className={buttonClass}
        disabled={isLoadingState || props.disabled}
        aria-busy={isLoadingState}
        aria-disabled={isLoadingState || props.disabled}
        {...props}
      >
        {isLoadingState ? (
          <>
            <span className="inline-flex items-center mr-2">
              <Spinner size="sm" />
            </span>
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
