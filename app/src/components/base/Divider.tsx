import { cn } from '@/lib/utils';
import React, { type ComponentPropsWithoutRef } from 'react';

type DividerProps = ComponentPropsWithoutRef<'hr'>;

export const Divider = React.forwardRef<HTMLHRElement, DividerProps>(
  ({ className, ...props }, ref) => {
    return <hr ref={ref} className={cn('border-dashed border-border', className)} {...props} />;
  },
);

Divider.displayName = 'Divider';
