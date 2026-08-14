// src/app/(full-width)/features/familjeschema/page.tsx
'use client';

import { notFound } from 'next/navigation';

/**
 * Familjeschemat är avaktiverat.
 *
 * Featuren är bortkopplad, inte borttagen: alla 31 filer under
 * `src/components/familjeschema/` ligger kvar orörda, backenden på
 * `/api/schedule/*` svarar fortfarande, och ingen rad har raderats ur
 * `family_member`, `activity` eller `schedule_settings`.
 *
 * Den här filen importerar med flit ingenting från featuren. Två skäl:
 *
 * 1. Med importerna kvar skulle komponentträdet fortsätta skeppas i bundlen
 *    (~88 kB) trots att sidan bara svarar 404.
 * 2. `styles/neobrutalism.css` är inte scopad — den innehåller en global
 *    `* { margin:0; padding:0 }`-reset och stilar på `body`. Reglerna låg kvar
 *    i dokumentet efter klientnavigering och påverkade andra sidor i samma
 *    session. Utan importen är den läckan borta.
 *
 * För att slå på featuren igen: återställ den här filen från git och ta bort
 * `disabled` på Familjeschema-posten i `src/components/FeatureNavigation.tsx`.
 */
export default function FamilySchedulePage() {
  notFound();
}
