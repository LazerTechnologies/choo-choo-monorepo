import type { ElementType, ComponentPropsWithoutRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const typographyVariants = cva('font-comic', {
  variants: {
    as: {
      p: 'text-base',
      body: 'text-base',
      caption: 'text-xs',
      li: 'text-base',
      a: 'text-base hover:underline underline-offset-2 decoration-primary',
      h1: 'font-sans text-4xl lg:text-5xl font-bold',
      h2: 'font-sans text-3xl lg:text-4xl font-semibold',
      h3: 'font-sans text-2xl font-medium',
      h4: 'font-sans text-xl font-normal',
      h5: 'font-sans text-lg font-normal',
      h6: 'font-sans text-base font-normal',
      label: 'font-medium text-sm',
      small: 'text-xs',
    },
  },
  defaultVariants: {
    as: 'p',
  },
});

type TypographyProps<T extends ElementType = 'p'> = {
  as?: T;
  variant?:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'body'
    | 'caption'
    | 'label'
    | 'small'
    | 'p'
    | 'li'
    | 'a';
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'> &
  VariantProps<typeof typographyVariants>;

export const Typography = <T extends ElementType = 'p'>(props: TypographyProps<T>) => {
  const { className, as, variant, ...otherProps } = props;
  // Map variant to semantic tag if as is not provided
  const tagMap: Record<string, ElementType> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5',
    h6: 'h6',
    label: 'label',
    small: 'small',
    body: 'p',
    caption: 'span',
    p: 'p',
    li: 'li',
    a: 'a',
  };
  const Tag = (as || (variant ? tagMap[variant] : 'p')) as ElementType;
  return (
    <Tag className={cn(typographyVariants({ as: variant || as }), className)} {...otherProps} />
  );
};
Typography.displayName = 'Typography';
