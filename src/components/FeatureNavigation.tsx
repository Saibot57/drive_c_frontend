'use client';

import { Check, ChevronsUpDown, Library, Calendar, CalendarDays, PieChart, Briefcase, LogOut, LogIn, Sigma, DoorOpen } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
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
import { isEditableElement } from '@/utils/dom';
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

/**
 * Sidor som inte står i menyn eller i genvägshjälpen. De finns här bara för
 * att menyknappen ska visa rätt namn när man väl är där.
 *
 * Terminsplaneraren nås med t-t-t (tre gånger inom en sekund, utanför
 * textfält) eller Ctrl+Alt+Shift+T. Det är en gömd dörr, inget lås:
 * sidan läser bara scheman som den inloggade redan har tillgång till.
 *
 * Veckolabbet nås via dörren längst ned till vänster i terminsplaneraren.
 * Det står före Termin, eftersom dess sökväg också matchar Termins.
 */
const hiddenFeatures: readonly Feature[] = [
  { label: 'Veckolabbet',     href: '/features/termin/labb',        icon: DoorOpen,     shortcut: '' },
  { label: 'Termin',          href: '/features/termin',             icon: Sigma,        shortcut: '' },
];

const TERM_PLANNER_HREF = '/features/termin';

export function FeatureNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, logout } = useAuth();

  const matches = (path: string, pattern: string) =>
    // Roten får bara matcha exakt — annars vinner den över varje annan sökväg.
    pattern === '/' ? path === '/' : path === pattern || path.startsWith(`${pattern}/`);

  const current =
    [...features, ...hiddenFeatures].find(
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

  // Egen lyssnare i stället för useHotkeys, som inte känner till Alt. Jämför
  // e.code: med Option på Mac blir e.key ett annat tecken än "t".
  //
  // Kombinationen kan fångas av operativsystemet eller webbläsaren innan sidan
  // ser den, så "t" tre gånger inom en sekund leder också dit. Det kräver inga
  // modifierare, och t är inte bundet någon annanstans. Inte i textfält.
  const tPresses = useRef<number[]>([]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        router.push(TERM_PLANNER_HREF);
        return;
      }

      // Chromes autofyll skickar keydown utan `key`, därav typkontrollen.
      if (e.ctrlKey || e.metaKey || e.altKey || typeof e.key !== 'string' || e.key.toLowerCase() !== 't') {
        tPresses.current = [];
        return;
      }
      if (e.repeat || isEditableElement(e.target)) return;

      const now = Date.now();
      tPresses.current = [...tPresses.current, now].filter(t => now - t < 1000);
      if (tPresses.current.length >= 3) {
        tPresses.current = [];
        router.push(TERM_PLANNER_HREF);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

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
