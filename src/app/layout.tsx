// src/app/layout.tsx
import React, { isValidElement, ReactElement } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import DefaultContainer from './components/DefaultContainer';
import RootLayoutBase from './components/RootLayoutBase';

export const metadata: Metadata = {
  title: 'Drive C',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (isValidElement(children) && children.type === RootLayoutBase) {
    return (
      <RootLayoutBase>{(children as ReactElement).props.children}</RootLayoutBase>
    );
  }

  return (
    <RootLayoutBase>
      <DefaultContainer>{children}</DefaultContainer>
    </RootLayoutBase>
  );
}

