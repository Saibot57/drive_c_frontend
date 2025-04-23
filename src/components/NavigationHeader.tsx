'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Calendar, Layout, FileText, LogOut, User, Layers } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export function NavigationHeader() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuth();
  
  // Get the title based on the current pathname
  const getTitle = (): string => {
    if (pathname === '/login') return 'Login';
    
    switch (pathname) {
      case '/':
        return 'Bibliotek';
      case '/features/calendar':
        return 'Kalender';
      case '/features/schedule':
        return 'Schema';
      case '/features/notes':
        return 'Anteckningar';
      case '/workspace':
        return 'Workspace';
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
    { name: 'Workspace', path: '/workspace', icon: <Layers className="h-5 w-5" /> }
  ];

  // Handle logout
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };
  
  return (
    <div className="flex items-center justify-between w-full">
      <h2 className="text-4xl font-monument">{getTitle()}</h2>
      
      {isAuthenticated ? (
        <div className="flex items-center space-x-4">
          {/* Navigation Links */}
          <nav className="flex items-center space-x-6 mr-4">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center ${
                  pathname === item.path
                    ? 'border-b-2 border-black font-medium'
                    : 'text-black hover:border-b-2 hover:border-black'
                } transition-colors`}
              >
                {item.icon}
                <span className="ml-2 font-monument">{item.name}</span>
              </Link>
            ))}
          </nav>
          
          {/* User menu and logout button */}
          <div className="flex items-center ml-4 space-x-2">
            <div className="flex items-center px-2 py-1 border-2 border-black rounded-lg bg-white">
              <User className="h-4 w-4 mr-2" />
              <span className="font-medium">{user?.username}</span>
            </div>
            <Button 
              onClick={handleLogout} 
              variant="neutral"
              className="flex items-center border-2 border-black"
              title="Logout"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      ) : pathname !== '/login' ? (
        <Link href="/login">
          <Button className="border-2 border-black bg-[#ff6b6b] text-white">
            Login
          </Button>
        </Link>
      ) : null}
    </div>
  );
}