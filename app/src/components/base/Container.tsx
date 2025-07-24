import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';
import { HTMLAttributes } from 'react';

const containerVariants = cva('container mx-auto px-4 sm:px-6 lg:px-8', {
  variants: {
    variant: {
      default: 'max-w-7xl',
      full: 'max-w-full',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface ContainerProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

export const Container = ({ className, variant, ...props }: ContainerProps) => {
  return <div className={cn(containerVariants({ variant }), className)} {...props} />;
};
