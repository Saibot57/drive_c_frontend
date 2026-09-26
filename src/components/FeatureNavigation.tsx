'use client';

import { Check, ChevronsUpDown, Library, Calendar, CalendarDays, PieChart, Briefcase, LogOut, LogIn } from 'lucide-react';
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

type Feature = {
  label: string;
  href: string;
  icon: typeof Library;
  /** Siffran i den globala genvägen `Ctrl+Shift+<siffra>`. */
  shortcut: string;
  /** Ytterligare sökvägar som ska visa den här posten som aktiv. */
  aliases?: readonly string[];
};

/**
 * Genvägssiffrorna står utskrivna i stället för att härledas ur ordningen, så
 * att en post kan läggas till eller tas bort utan att de andra numreras om.
 * 4 är ledig sedan Familjeschema togs bort. `src/config/shortcuts.ts` visar
 * samma siffror i hjälpen och måste följa med om de ändras.
 */
const features: readonly Feature[] = [
  { label: 'Bibliotek',       href: '/features/bibliotek',          icon: Library,      shortcut: '1' },
  // Schemaplaneraren är startsidan. `/features/schedule` renderar samma sida
  // och behålls för gamla bokmärken, därav aliaset.
  { label: 'Schema',          href: '/',                            icon: Calendar,     shortcut: '2',
    aliases: ['/features/schedule'] },
  { label: 'Temakalender',    href: '/features/temakalender',       icon: PieChart,     shortcut: '3' },
  { label: 'Kalender',        href: '/features/calendar',           icon: CalendarDays, shortcut: '5' },
  { label: 'Workspace',       href: '/workspace',                   icon: Briefcase,    shortcut: '6' },
];

export function FeatureNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();

  const matches = (path: string, pattern: string) =>
    // Roten får bara matcha exakt — annars vinner den över varje annan sökväg.
    pattern === '/' ? path === '/' : path === pattern || path.startsWith(`${pattern}/`);

  const current =
    features.find(
      f => matches(pathname, f.href) || f.aliases?.some(a => matches(pathname, a)),
    ) ?? features[0];

  const Icon = current.icon;

  useHotkeys(
    features.map(f => ({
      key: f.shortcut,
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
              'bg-white border-none cursor-pointer rounded-md px-2 py-1.5',
              'hover:bg-black/5 transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2',
            )}
            aria-label="Switch feature"
          >
            <Icon size={18} />
            {current.label.toUpperCase()}
            <ChevronsUpDown size={14} className="opacity-40 ml-0.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-52 bg-white">
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
                <span className="ml-auto text-xs text-gray-400 truncate max-w-[80px]">
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
