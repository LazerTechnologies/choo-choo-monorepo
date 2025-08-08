'use client';

import * as SwitchPrimitives from '@radix-ui/react-switch';

import * as React from 'react';

import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-main data-[state=unchecked]:bg-white dark:data-[state=unchecked]:bg-secondaryBlack data-[state=checked]:border-purple-600 data-[state=unchecked]:border-purple-400',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-white border-2 transition-transform shadow-md data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-1 data-[state=checked]:border-white data-[state=unchecked]:border-purple-500 data-[state=checked]:ring-2 data-[state=checked]:ring-white data-[state=unchecked]:ring-2 data-[state=unchecked]:ring-purple-500'
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
