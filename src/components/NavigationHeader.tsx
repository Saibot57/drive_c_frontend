'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Calendar, Layout, FileText, BugOff } from 'lucide-react';

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
      case '/features/notes':
        return 'Anteckningar';
      case '/features/snake':
        return 'Snake';
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
  
  // Navigation items with their paths and icons
  const navItems = [
    { name: 'Bibliotek', path: '/', icon: <BookOpen className="h-5 w-5" /> },
    { name: 'Kalender', path: '/features/calendar', icon: <Calendar className="h-5 w-5" /> },
    { name: 'Schema', path: '/features/schedule', icon: <Layout className="h-5 w-5" /> },
    { name: 'Anteckningar', path: '/features/notes', icon: <FileText className="h-5 w-5" /> },
    { name: 'Snake', path: '/features/snake', icon: <BugOff className="h-5 w-5" /> }
  ];
  
  return (
    <div className="flex items-center justify-between w-full">
      <h2 className="text-4xl font-monument">{getTitle()}</h2>
      
      {/* Navigation Links */}
      <nav className="flex items-center space-x-6">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.path}
            className={`flex items-center ${
              pathname === item.path
                ? 'text-[#ff6b6b] font-bold'
                : 'text-black hover:text-[#ff6b6b]'
            } transition-colors`}
          >
            {item.icon}
            <span className="ml-2 font-monument">{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}