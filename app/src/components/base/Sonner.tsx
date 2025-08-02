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
          '--normal-bg': 'rgba(167, 139, 250, 0.8)',
          '--normal-text': '#fff',
          '--normal-border': '#fff',
          zIndex: 9999,
          ...props.style,
        } as React.CSSProperties
      }
      toastOptions={{
        className: 'border-2 shadow-md',
        style: {
          backgroundColor: 'rgba(167, 139, 250, 0.8)',
          color: '#fff',
          border: '2px solid #fff',
        },
      }}
      position="top-center"
      richColors
    />
  );
};

export { Toaster, toast };
