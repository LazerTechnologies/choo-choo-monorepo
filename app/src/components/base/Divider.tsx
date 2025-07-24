import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

type DividerProps = HTMLAttributes<HTMLHRElement>;

export const Divider = ({ className, ...props }: DividerProps) => {
  return <hr className={cn('border-dashed border-border', className)} {...props} />;
};
