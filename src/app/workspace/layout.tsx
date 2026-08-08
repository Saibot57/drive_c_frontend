'use client';

/**
 * Workspace hade tidigare en egen Inter-uppsättning här, vilket gjorde att
 * modulen skrev med ett annat typsnitt än resten av appen. Rubrikerna kommer
 * från Monument via FeatureNavigation och brödtexten från Red Hat Text på
 * body, precis som i schemat och temakalendern.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
