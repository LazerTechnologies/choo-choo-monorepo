'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, ToasterProps } from 'sonner';

const Toaster = (props: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      {...props}
      theme={(props.theme ?? theme) as ToasterProps['theme']}
      className={`toaster group ${props.className ?? ''}`}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          ...props.style,
        } as React.CSSProperties
      }
    />
  );
};

export { Toaster };
