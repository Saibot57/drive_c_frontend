'use client';

import React from 'react';
import { Red_Hat_Text } from 'next/font/google';
import localFont from 'next/font/local';
import { AuthProvider } from '@/contexts/AuthContext';

const redHat = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

const monument = localFont({
  src: [
    {
      path: '../../fonts/MonumentExtended-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../fonts/MonumentExtended-Ultrabold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-monument',
});

export default function RootLayoutBase({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>Drive C</title>
      </head>
      <body className={`${redHat.className} ${monument.variable} min-h-screen bg-white`}>
        <AuthProvider>
          <main className="pt-8 px-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
