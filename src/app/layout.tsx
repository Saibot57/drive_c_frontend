// src/app/layout.tsx
import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import RootLayoutBase from './components/RootLayoutBase';

export const metadata: Metadata = {
  title: 'Drive C',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootLayoutBase>{children}</RootLayoutBase>;
}

