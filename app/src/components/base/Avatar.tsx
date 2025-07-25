import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';

const avatarVariants = cva('relative flex rounded-full overflow-hidden', {
  variants: {
    size: {
      sm: 'h-8 w-8',
      md: 'h-14 w-14',
      lg: 'h-24 w-24',
    },
    borderThickness: {
      none: 'border-0',
      sm: 'border',
      md: 'border-2',
      lg: 'border-4',
    },
  },
  defaultVariants: {
    size: 'md',
    borderThickness: 'md',
  },
});

interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, borderThickness, ...props }, ref) => (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size, borderThickness }), className)}
      {...props}
    />
  )
);
Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = 'Avatar.Image';

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-primary',
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = 'Avatar.Fallback';

interface AvatarComponentType
  extends React.ForwardRefExoticComponent<AvatarProps & React.RefAttributes<HTMLDivElement>> {
  Image: typeof AvatarImage;
  Fallback: typeof AvatarFallback;
}

const AvatarComponent = Object.assign(Avatar, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
}) as AvatarComponentType;

export { AvatarComponent as Avatar };
