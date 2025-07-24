import NextImage, { ImageProps as NextImageProps } from 'next/image';
import { cn } from '@/lib/utils';

interface ImageProps extends NextImageProps {}

export const Image = ({ className, ...props }: ImageProps) => {
  return <NextImage className={cn('w-full h-auto', className)} {...props} />;
};
