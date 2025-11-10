import React from 'react';
import NextImage, { type ImageProps as NextImageProps } from 'next/image';
import { cn } from '@/lib/utils';

export const ResponsiveImage = React.forwardRef<HTMLImageElement, NextImageProps>(
  ({ className, ...props }, ref) => {
    return <NextImage ref={ref} className={cn('w-full h-auto', className)} {...props} />;
  },
);
ResponsiveImage.displayName = 'ResponsiveImage';
