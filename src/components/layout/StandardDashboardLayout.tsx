'use client';

import { ReactNode } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

const NEO_PRIMARY = 'cc-toolbar';
const NEO_SECONDARY = 'cc-toolbar-sm';

interface StandardDashboardLayoutProps {
  topToolbar: ReactNode;
  leftSidebar?: ReactNode;
  centerContent: ReactNode;
  rightSidebar?: ReactNode;
  /** Tailwind width class for the left sidebar. Default: w-[280px] (static mode only) */
  leftSidebarWidth?: string;
  /** Tailwind width class for the right sidebar. Default: w-[280px] (static mode only) */
  rightSidebarWidth?: string;
  /** Tailwind height class for the workspace row. Default: h-[calc(100vh-10rem)] (static mode only) */
  workspaceHeight?: string;
  /** Layout mode. Default: 'static' */
  mode?: 'static' | 'resizable';
  /** Height of the root element in resizable mode. Default: 'h-[calc(100vh-2rem)]' */
  resizableHeight?: string;
  /** Default size (%) of the left panel in resizable mode. Default: 30 */
  defaultLeftSize?: number;
  /** Default size (%) of the center panel in resizable mode. Default: 70 */
  defaultCenterSize?: number;
  /** Default size (%) of the right sidebar in resizable mode. Default: 20 */
  defaultRightSize?: number;
  className?: string;
}

/**
 * StandardDashboardLayout
 *
 * Two modes:
 *
 * static (default) — Split-Height topology:
 *   div.flex.flex-col.lg:flex-row.gap-6          ← ROOT
 *   ├── div.flex-1.min-w-0.space-y-6              ← Child A
 *   │   ├── [Toolbar panel]                        ← spans Child A width
 *   │   └── div.flex.gap-6.{workspaceHeight}       ← Workspace row
 *   │       ├── [Left Sidebar panel] (optional)
 *   │       └── [Center Content panel]
 *   └── [Right Sidebar panel] (optional)           ← full height alongside Child A
 *
 * resizable — ResizablePanelGroup topology:
 *   div.{resizableHeight}
 *   └── RPG horizontal
 *       ├── Panel A (flex-col)
 *       │   ├── Toolbar (NEO wrapper, shrink-0)
 *       │   └── RPG horizontal (flex-1)
 *       │       ├── Left Panel (optional)
 *       │       └── Center Panel
 *       └── Panel B — Right Sidebar (optional)
 *
 * In static mode all panels get NEO wrappers. In resizable mode SDL does NOT
 * wrap left/center/right content — the page supplies its own NEO styling.
 */
export function StandardDashboardLayout({
  topToolbar,
  leftSidebar,
  centerContent,
  rightSidebar,
  leftSidebarWidth = 'w-[280px]',
  rightSidebarWidth = 'w-[280px]',
  workspaceHeight = 'h-[calc(100vh-10rem)]',
  mode = 'static',
  resizableHeight = 'h-[calc(100vh-2rem)]',
  defaultLeftSize = 30,
  defaultCenterSize = 70,
  defaultRightSize = 20,
  className,
}: StandardDashboardLayoutProps) {
  /* ── Resizable mode ─────────────────────────────────────────────── */
  if (mode === 'resizable') {
    return (
      <div className={`${resizableHeight} ${className ?? ''}`}>
        <ResizablePanelGroup direction="horizontal">
          {/* Panel A: Toolbar + inner horizontal panels */}
          <ResizablePanel className="overflow-hidden">
            <div className="flex flex-col h-full gap-3">
              {/* Toolbar — primary NEO wrapper */}
              <div className={`${NEO_PRIMARY} p-4 flex items-center gap-4 flex-wrap shrink-0`}>
                {topToolbar}
              </div>

              {/* Inner horizontal RPG */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ResizablePanelGroup direction="horizontal">
                  {leftSidebar && (
                    <>
                      <ResizablePanel
                        defaultSize={defaultLeftSize}
                        className="overflow-hidden"
                      >
                        {leftSidebar}
                      </ResizablePanel>
                      <ResizableHandle withHandle />
                    </>
                  )}
                  <ResizablePanel
                    defaultSize={leftSidebar ? defaultCenterSize : undefined}
                    className="overflow-hidden"
                  >
                    {centerContent}
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            </div>
          </ResizablePanel>

          {/* Panel B: Right Sidebar */}
          {rightSidebar && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={defaultRightSize}
                className="overflow-hidden"
              >
                {rightSidebar}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    );
  }

  /* ── Static mode (original code unchanged) ──────────────────────── */
  return (
    <div className={`flex flex-col lg:flex-row gap-6 ${className ?? ''}`}>
      {/* ── Child A: Toolbar + Workspace ─────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Toolbar — primary */}
        <div className={`${NEO_PRIMARY} p-4 flex items-center gap-4 flex-wrap`}>
          {topToolbar}
        </div>

        {/* Workspace row — secondary */}
        <div className={`flex flex-col lg:flex-row gap-6 ${workspaceHeight}`}>
          {leftSidebar && (
            <div className={`${leftSidebarWidth} ${NEO_SECONDARY} overflow-hidden flex flex-col shrink-0`}>
              {leftSidebar}
            </div>
          )}
          <div className={`flex-1 min-w-0 ${NEO_SECONDARY} overflow-hidden flex flex-col`}>
            {centerContent}
          </div>
        </div>
      </div>

      {/* ── Right Sidebar: full height alongside Child A ─────────── */}
      {rightSidebar && (
        <div className={`${rightSidebarWidth} ${NEO_SECONDARY} overflow-hidden flex flex-col shrink-0`}>
          {rightSidebar}
        </div>
      )}
    </div>
  );
}
