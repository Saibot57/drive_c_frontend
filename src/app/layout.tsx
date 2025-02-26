// src/app/layout.tsx
import type { Metadata } from 'next'
import { Red_Hat_Text } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { NavigationHeader } from '@/components/NavigationHeader'
import { NavigationDrawer } from '@/components/NavigationDrawer'

const redHat = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500', '700']
})

const monument = localFont({
  src: [
    {
      path: '../fonts/MonumentExtended-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/MonumentExtended-Ultrabold.otf',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-monument'
})

export const metadata: Metadata = {
  title: 'Bibliotek',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${redHat.className} ${monument.variable} min-h-screen bg-[#fcd7d7]`}>
        {/* Navigation Drawer */}
        <NavigationDrawer />

        {/* Top Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 h-16 bg-[#fcd7d7] z-20">
          {/* Bottom border */}
          <div className="absolute bottom-0 left-0 right-0 border-b-2 border-black"></div>
          
          <div className="h-full flex items-center px-8 ml-16">
            <NavigationHeader />
          </div>
        </div>

        {/* Main Content */}
        <main className="pt-20 px-8">
          <div className="max-w-[1000px] mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}