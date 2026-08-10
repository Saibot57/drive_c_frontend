'use client';

import React from 'react';
import { Red_Hat_Text, Bangers, Archivo_Black } from 'next/font/google';
import localFont from 'next/font/local';
import { AuthProvider } from '@/contexts/AuthContext';

const redHat = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-redhat',
});

/*
 * Rubriktypsnitten i workspace. De laddas här, på body, och inte i
 * workspace-modulen — next/font kräver anrop i modulomfång, och samma font
 * som laddas på två ställen blir två nedladdningar.
 *
 * Bara `variable` används, inte `className`: de ska vara valbara per rubrik,
 * aldrig ärvda. Brödtexten är fortfarande Red Hat Text.
 * Båda har verifierad täckning för å ä ö (latin-subsetet, 222 resp. 220 glyfer).
 */
const bangers = Bangers({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bangers',
});

const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-archivo',
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
      <body
        className={`${redHat.className} ${redHat.variable} ${monument.variable} ${bangers.variable} ${archivoBlack.variable} min-h-screen bg-white`}
      >
        <AuthProvider>
          <main className="pt-8 px-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
