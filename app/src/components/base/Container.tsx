import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';

const containerVariants = cva('container mx-auto px-4 sm:px-6 lg:px-8', {
  variants: {
    width: {
      default: 'max-w-7xl',
      full: 'max-w-full',
    },
  },
  defaultVariants: {
    width: 'default',
  },
});

interface ContainerProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, width, ...props }, ref) => {
    return <div ref={ref} className={cn(containerVariants({ width }), className)} {...props} />;
  }
);

Container.displayName = 'Container';
