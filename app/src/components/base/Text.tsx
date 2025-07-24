import type { ElementType, HTMLAttributes } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textVariants = cva('font-sans', {
  variants: {
    as: {
      p: 'text-base',
      li: 'text-base',
      a: 'text-base hover:underline underline-offset-2 decoration-primary',
      h1: 'font-heading text-4xl lg:text-5xl font-bold',
      h2: 'font-heading text-3xl lg:text-4xl font-semibold',
      h3: 'font-heading text-2xl font-medium',
      h4: 'font-heading text-xl font-normal',
      h5: 'font-heading text-lg font-normal',
      h6: 'font-heading text-base font-normal',
    },
  },
  defaultVariants: {
    as: 'p',
  },
});

interface TextProps
  extends Omit<HTMLAttributes<HTMLElement>, 'className'>,
    VariantProps<typeof textVariants> {
  className?: string;
}

export const Text = (props: TextProps) => {
  const { className, as, ...otherProps } = props;
  const Tag: ElementType = as || 'p';

  return <Tag className={cn(textVariants({ as }), className)} {...otherProps} />;
};
