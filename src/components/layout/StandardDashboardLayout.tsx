'use client';

import { ReactNode } from 'react';

const NEO = 'rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]';

interface StandardDashboardLayoutProps {
  topToolbar: ReactNode;
  leftSidebar?: ReactNode;
  centerContent: ReactNode;
  rightSidebar?: ReactNode;
  /** Tailwind width class for the left sidebar. Default: w-[280px] */
  leftSidebarWidth?: string;
  /** Tailwind width class for the right sidebar. Default: w-[280px] */
  rightSidebarWidth?: string;
  /** Tailwind height class for the workspace row. Default: h-[calc(100vh-10rem)] */
  workspaceHeight?: string;
  className?: string;
}

/**
 * StandardDashboardLayout
 *
 * Replicates the NewSchedulePlanner "Split-Height" topology:
 *
 *   div.flex.flex-col.lg:flex-row.gap-6          ← ROOT
 *   ├── div.flex-1.min-w-0.space-y-6              ← Child A
 *   │   ├── [Toolbar panel]                        ← spans Child A width
 *   │   └── div.flex.gap-6.{workspaceHeight}       ← Workspace row
 *   │       ├── [Left Sidebar panel] (optional)
 *   │       └── [Center Content panel]
 *   └── [Right Sidebar panel] (optional)           ← full height alongside Child A
 *
 * All panels get neobrutalism classes: rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,1)]
 */
export function StandardDashboardLayout({
  topToolbar,
  leftSidebar,
  centerContent,
  rightSidebar,
  leftSidebarWidth = 'w-[280px]',
  rightSidebarWidth = 'w-[280px]',
  workspaceHeight = 'h-[calc(100vh-10rem)]',
  className,
}: StandardDashboardLayoutProps) {
  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${className ?? ''}`}>
      {/* ── Child A: Toolbar + Workspace ─────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Toolbar */}
        <div className={`${NEO} p-4 flex items-center gap-4 flex-wrap`}>
          {topToolbar}
        </div>

        {/* Workspace row */}
        <div className={`flex flex-col lg:flex-row gap-6 ${workspaceHeight}`}>
          {leftSidebar && (
            <div className={`${leftSidebarWidth} ${NEO} overflow-hidden flex flex-col shrink-0`}>
              {leftSidebar}
            </div>
          )}
          <div className={`flex-1 min-w-0 ${NEO} overflow-hidden flex flex-col`}>
            {centerContent}
          </div>
        </div>
      </div>

      {/* ── Right Sidebar: full height alongside Child A ─────────── */}
      {rightSidebar && (
        <div className={`${rightSidebarWidth} ${NEO} overflow-hidden flex flex-col shrink-0`}>
          {rightSidebar}
        </div>
      )}
    </div>
  );
}
