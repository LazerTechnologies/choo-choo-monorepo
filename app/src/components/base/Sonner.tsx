'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, ToasterProps, toast } from 'sonner';

const Toaster = (props: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      {...props}
      theme={(props.theme ?? theme) as ToasterProps['theme']}
      className={`toaster group ${props.className ?? ''}`}
      style={
        {
          '--normal-bg': 'hsl(var(--card))',
          '--normal-text': 'hsl(var(--card-foreground))',
          '--normal-border': 'hsl(var(--border))',
          zIndex: 9999,
          ...props.style,
        } as React.CSSProperties
      }
      toastOptions={{
        className: 'border-2 shadow-md bg-card text-card-foreground',
        style: {
          backgroundColor: 'hsl(var(--card))',
          color: 'hsl(var(--card-foreground))',
          border: '2px solid hsl(var(--border))',
        },
      }}
      position="top-center"
      richColors
    />
  );
};

export { Toaster, toast };
