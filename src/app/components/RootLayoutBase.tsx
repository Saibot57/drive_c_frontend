'use client';

import React, { useState } from 'react';
import { Red_Hat_Text } from 'next/font/google';
import localFont from 'next/font/local';
import { NavigationHeader } from '@/components/NavigationHeader';
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
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>Drive C</title>
      </head>
      <body className={`${redHat.className} ${monument.variable} min-h-screen bg-white`}>
        <AuthProvider>
          {/* Invisible hover trigger at the very top of the viewport */}
          <div
            className="h-4 w-full fixed top-0 z-40"
            onMouseEnter={() => setIsHeaderVisible(true)}
            onMouseLeave={() => setIsHeaderVisible(false)}
          />

          {/* Top Navigation Bar — slides in/out on hover */}
          <div
            className={`fixed top-0 left-0 right-0 h-16 bg-[#fcd7d7] z-50 transition-transform duration-300 ${
              isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
            }`}
            onMouseEnter={() => setIsHeaderVisible(true)}
            onMouseLeave={() => setIsHeaderVisible(false)}
          >
            {/* Bottom border */}
            <div className="absolute bottom-0 left-0 right-0 border-b-2 border-black"></div>

            <div className="h-full flex items-center px-8">
              <NavigationHeader />
            </div>
          </div>

          {/* Main Content — pt-8 gives 32px breathing room so background shows above panels */}
          <main className="pt-8 px-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
