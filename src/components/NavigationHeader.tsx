// src/components/NavigationHeader.tsx
'use client';

import { usePathname } from 'next/navigation';

export function NavigationHeader() {
  const pathname = usePathname();
  
  // Get the title based on the current pathname
  const getTitle = (): string => {
    switch (pathname) {
      case '/':
        return 'Bibliotek';
      case '/features/calendar':
        return 'Kalender';
      case '/features/schedule':
        return 'Schema';
      default:
        // Extract the last part of the path if it's a new route
        const pathParts = pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          // Capitalize the first letter
          const lastPart = pathParts[pathParts.length - 1];
          return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
        }
        return 'Bibliotek';
    }
  };

  return (
<<<<<<< Updated upstream
    <nav className="flex space-x-8">
      <Link 
        href="/features/calendar" 
        className={`text-3xl font-monument transition-colors ${
          pathname === '/features/calendar' ? 'text-[#ff6b6b]' : 'hover:text-[#ff6b6b]'
        }`}
      >
        Kalender
      </Link>
      <span className="text-3xl font-monument">Schema</span>
      <span className="text-3xl font-monument">TBA</span>
    </nav>
  )
=======
    <div className="flex items-center">
      <h2 className="text-4xl font-monument">{getTitle()}</h2>
    </div>
  );
>>>>>>> Stashed changes
}