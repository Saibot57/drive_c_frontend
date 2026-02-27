'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, BookOpen, Calendar, Layout, Layers } from 'lucide-react';

export function NavigationDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  // Navigation items with their paths and icons
  const navItems = [
    { name: 'Bibliotek', path: '/', icon: <BookOpen className="h-5 w-5" /> },
    { name: 'Kalender', path: '/features/calendar', icon: <Calendar className="h-5 w-5" /> },
    { name: 'Schema', path: '/features/schedule', icon: <Layout className="h-5 w-5" /> },
{ name: 'Workspace', path: '/workspace', icon: <Layers className="h-5 w-5" /> }
  ];

  // Close the drawer when clicking outside
  const handleOutsideClick = () => {
    if (isOpen) setIsOpen(false);
  };

  return (
    <>
      {/* Menu button */}
      <button 
        onClick={toggleDrawer} 
        className="nav-toggle-button top-4 left-4 h-10 w-10"
        aria-label="Toggle navigation menu"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Drawer background overlay */}
      <div 
        className={`fixed inset-0 bg-black/20 z-30 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleOutsideClick}
      />

      {/* Drawer content */}
      <div 
        className={`nav-drawer ${isOpen ? 'nav-drawer-open' : 'nav-drawer-closed'}`}
      >
        <div className="pt-16 px-4">
          <nav className="flex flex-col space-y-4 items-start">
            {navItems.map((item) => (
              <Link 
                key={item.name}
                href={item.path} 
                className={`nav-item ${pathname === item.path ? 'nav-item-active' : 'nav-item-inactive'}`}
                onClick={() => setIsOpen(false)}
              >
                {item.icon}
                <span className="text-xl font-monument">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}