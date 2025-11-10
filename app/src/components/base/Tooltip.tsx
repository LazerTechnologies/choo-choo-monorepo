'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

const tooltipContentVariants = cva(
  'z-50 overflow-hidden rounded-base border-2 border-border dark:border-darkBorder px-3 py-1.5 text-sm font-base animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]',
  {
    variants: {
      variant: {
        default: 'bg-main text-text',
        primary: 'bg-primary text-primary-foreground',
        solid: 'bg-black text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> &
    VariantProps<typeof tooltipContentVariants>
>(({ className, sideOffset = 4, variant, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={tooltipContentVariants({
        variant,
        className,
      })}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

const TooltipObject = Object.assign(Tooltip, {
  Trigger: TooltipTrigger,
  Content: TooltipContent,
  Provider: TooltipProvider,
});

export { TooltipObject as Tooltip };
