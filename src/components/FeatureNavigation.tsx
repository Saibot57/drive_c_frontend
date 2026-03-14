'use client';

import { Check, ChevronsUpDown, Library, Calendar, Users, Briefcase, Terminal, LogOut, LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHotkeys } from '@/hooks/useHotkeys';
import { ShortcutHelpOverlay } from '@/components/ShortcutHelpOverlay';
import { useAuth } from '@/contexts/AuthContext';

const features = [
  { label: 'Bibliotek',       href: '/',                            icon: Library   },
  { label: 'Schema',          href: '/features/schedule',           icon: Calendar  },
  { label: 'Familjeschema',   href: '/features/familjeschema',      icon: Users     },
  { label: 'Skrivbord',        href: '/features/command-center',     icon: Terminal  },
  { label: 'Workspace',       href: '/workspace',                   icon: Briefcase },
] as const;

export function FeatureNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();

  const current =
    features.find(f => {
      if (f.href === '/') return pathname === '/';
      return pathname.startsWith(f.href);
    }) ?? features[0];

  const Icon = current.icon;

  useHotkeys(
    features.map((f, i) => ({
      key: String(i + 1),
      ctrl: true,
      shift: true,
      handler: () => router.push(f.href),
      allowInInput: true,
    })),
    [router],
  );

  return (
    <>
      <ShortcutHelpOverlay />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center gap-2 font-monument text-xl leading-none tracking-[0.2em] select-none',
              'bg-t-card border-none cursor-pointer rounded-md px-2 py-1.5',
              'hover:bg-black/5 transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-t-ring focus-visible:ring-offset-2',
            )}
            aria-label="Switch feature"
          >
            <Icon size={18} />
            {current.label.toUpperCase()}
            <ChevronsUpDown size={14} className="opacity-40 ml-0.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-52 bg-t-card">
          {features.map(feature => {
            const FeatureIcon = feature.icon;
            const isActive = feature.href === current.href;

            return (
              <DropdownMenuItem key={feature.href} asChild>
                <Link
                  href={feature.href}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    isActive && 'font-semibold',
                  )}
                >
                  <FeatureIcon size={15} />
                  {feature.label}
                  {isActive && <Check size={13} className="ml-auto" />}
                </Link>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          {isAuthenticated ? (
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => { logout(); window.location.href = '/login'; }}
            >
              <LogOut size={15} />
              <span>Logga ut</span>
              {user && (
                <span className="ml-auto text-xs text-t-text-muted truncate max-w-[80px]">
                  {user.username}
                </span>
              )}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link href="/login" className="flex items-center gap-2 cursor-pointer">
                <LogIn size={15} />
                <span>Logga in</span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
