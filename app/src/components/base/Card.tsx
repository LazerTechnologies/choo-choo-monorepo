import { cn } from '@/lib/utils';
import { HTMLAttributes, forwardRef } from 'react';
import { Typography } from '@/components/base/Typography';

interface CardSubcomponents {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Content: typeof CardContent;
}

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'inline-block border-2 shadow-md transition-all hover:shadow-xs bg-card',
        className
      )}
      {...props}
    />
  );
}) as React.ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>
> &
  CardSubcomponents;

Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardHeader(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn('flex flex-col justify-start p-4', className)} {...props} />;
});
CardHeader.displayName = 'Card.Header';

const CardTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardTitle({
  className,
  ...props
}) {
  return <Typography as="h3" className={cn('mb-2', className)} {...props} />;
});
CardTitle.displayName = 'Card.Title';

const CardDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardDescription({ className, ...props }, ref) {
    return <p ref={ref} className={cn('text-muted-foreground', className)} {...props} />;
  }
);
CardDescription.displayName = 'Card.Description';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function CardContent(
  { className, ...props },
  ref
) {
  return <div ref={ref} className={cn('p-4', className)} {...props} />;
});
CardContent.displayName = 'Card.Content';

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;

export { Card };
