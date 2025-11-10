import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const spinnerVariants = cva(
  'animate-spin rounded-full border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]',
  {
    variants: {
      size: {
        xs: 'w-3 h-3 border-2',
        sm: 'w-4 h-4 border-2.5',
        md: 'w-5 h-5 border-4',
        lg: 'w-6 h-6 border-6',
        xl: 'w-8 h-8 border-8',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  className?: string;
}

export const Spinner = ({
  className,
  size,
  'aria-label': ariaLabel = 'Loading',
  ...props
}: SpinnerProps) => {
  return (
    <div
      className={cn(spinnerVariants({ size }), className)}
      role="status"
      aria-label={ariaLabel}
      {...props}
    />
  );
};
