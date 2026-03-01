'use client';

import { Check, ChevronsUpDown, Library, Calendar, Users, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const features = [
  { label: 'Bibliotek',     href: '/',                     icon: Library   },
  { label: 'Schema',        href: '/features/schedule',    icon: Calendar  },
  { label: 'Familjeschema', href: '/features/familjeschema', icon: Users   },
  { label: 'Workspace',     href: '/workspace',            icon: Briefcase },
] as const;

export function FeatureNavigation() {
  const pathname = usePathname();

  const current =
    features.find(f => {
      if (f.href === '/') return pathname === '/';
      return pathname.startsWith(f.href);
    }) ?? features[0];

  const Icon = current.icon;

  return (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
