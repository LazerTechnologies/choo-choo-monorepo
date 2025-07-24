import { cn } from '@/lib/utils';
import { cva, VariantProps } from 'class-variance-authority';
import { icons, LucideProps } from 'lucide-react';

const iconVariants = cva('', {
  variants: {
    size: {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
      xl: 'w-8 h-8',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

interface IconProps extends VariantProps<typeof iconVariants> {
  name: keyof typeof icons;
  className?: string;
  props?: LucideProps;
}

export const Icon = ({ name, className, props, size }: IconProps) => {
  const LucideIcon = icons[name];

  return <LucideIcon className={cn(iconVariants({ size }), className)} {...props} />;
};
