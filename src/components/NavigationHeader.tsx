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
    <div className="flex items-center">
      <h2 className="text-4xl font-monument">{getTitle()}</h2>
    </div>
  );
}