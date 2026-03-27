'use client';

import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={inter.variable}>{children}</div>;
}
