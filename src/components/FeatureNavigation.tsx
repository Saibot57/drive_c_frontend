'use client';

import { Check, ChevronsUpDown, Library, Calendar, CalendarDays, PieChart, Users, Briefcase, LogOut, LogIn } from 'lucide-react';
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
  /** Ytterligare sökvägar som ska visa den här posten som aktiv. */
  aliases?: readonly string[];
};

/**
 * Ordningen styr de globala genvägarna: `Ctrl+Shift+1..6` härleds ur index
 * nedan (se useHotkeys-anropet). Kastar man om raderna numreras genvägarna om
 * tyst, och `src/config/shortcuts.ts` måste uppdateras i samma veva.
 */
const features: readonly Feature[] = [
  { label: 'Bibliotek',       href: '/features/bibliotek',          icon: Library   },
  // Schemaplaneraren är startsidan. `/features/schedule` renderar samma sida
  // och behålls för gamla bokmärken, därav aliaset.
  { label: 'Schema',          href: '/',                            icon: Calendar,
    aliases: ['/features/schedule'] },
  { label: 'Temakalender',    href: '/features/temakalender',       icon: PieChart  },
  { label: 'Familjeschema',   href: '/features/familjeschema',      icon: Users     },
  { label: 'Kalender',        href: '/features/calendar',           icon: CalendarDays },
  { label: 'Workspace',       href: '/workspace',                   icon: Briefcase },
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
