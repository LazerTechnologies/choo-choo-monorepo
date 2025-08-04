import * as React from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', placeholder, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        className={cn(
          'flex h-10 w-full rounded-base border-2 text-text dark:text-darkText font-base selection:bg-main selection:text-text border-border dark:border-darkBorder bg-white dark:bg-secondaryBlack px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition shadow-md focus:shadow-xs',
          // Error state handling
          props['aria-invalid'] ? 'border-red-500 text-red-500 shadow-xs shadow-red-600' : '',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
