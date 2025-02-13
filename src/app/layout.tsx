import type { Metadata } from 'next'
import { Red_Hat_Text } from 'next/font/google'
import './globals.css'

const redHat = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500', '700']  // Common weights, add or remove as needed
})

export const metadata: Metadata = {
  title: 'File Browser',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${redHat.className} min-h-screen bg-[#fcd7d7]`}>
        {/* Header */}
        <header className="w-full px-4 py-4 mb-8">
          <div className="max-w-[1500px] mx-auto bg-[#fcd7d7] rounded-2xl border-2 border-white p-4">
            <h1 className="text-2xl font-bold">File Browser</h1>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-120px)]">
          {/* Sidebar - we'll add content later */}
          <div className="w-64 bg-[#fcd7d7] rounded-2xl border-2 border-white p-4 hidden md:block">
            {/* Sidebar content will go here */}
          </div>

          {/* Main content area */}
          <main className="flex-1 px-4 py-8">
            {/* Main content */}
            <div className="max-w-[1500px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}