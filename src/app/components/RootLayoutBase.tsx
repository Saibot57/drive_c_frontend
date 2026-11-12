'use client';

import React from 'react';
import localFont from 'next/font/local';
import { AuthProvider } from '@/contexts/AuthContext';
import { THEME_INIT_SCRIPT } from '@/config/uiTheme';

/*
 * Alla typsnitt ligger i src/fonts, så att bygget inte hämtar något från
 * Google Fonts: när hämtningen misslyckades föll bygget i CI. Filerna är
 * latin-subseten från Fontsource (OFL 1.1, licenserna i src/fonts/licenser).
 */
const redHat = localFont({
  src: [
    { path: '../../fonts/red-hat-text-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/red-hat-text-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../fonts/red-hat-text-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-redhat',
});

/*
 * Rubriktypsnitten i workspace. De laddas här, på body, och inte i
 * workspace-modulen — next/font kräver anrop i modulomfång, och samma font
 * som laddas på två ställen blir två nedladdningar.
 *
 * Bara `variable` används, inte `className`: de ska vara valbara per rubrik,
 * aldrig ärvda. Brödtexten är fortfarande Red Hat Text.
 * Båda har verifierad täckning för å ä ö (latin-subsetet, 222 resp. 220 glyfer).
 */
const bangers = localFont({
  src: '../../fonts/bangers-latin-400-normal.woff2',
  weight: '400',
  variable: '--font-bangers',
});

const archivoBlack = localFont({
  src: '../../fonts/archivo-black-latin-400-normal.woff2',
  weight: '400',
  variable: '--font-archivo',
});

const monument = localFont({
  src: [
    {
      path: '../../fonts/MonumentExtended-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../fonts/MonumentExtended-Ultrabold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-monument',
});

/*
 * Temat Kronberg (docs/plans/kronberg-tema.md). Laddas i båda temana, eftersom
 * next/font inte kan laddas villkorligt. Variablerna sitter på <html> och inte
 * på <body>: tokens.css läser dem på :root, och där hade en variabel från
 * <body> inte funnits.
 */
const plexMono = localFont({
  src: [
    { path: '../../fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
});

// Variabelt i både vikt och bredd; globals.css sätter font-stretch: 88%.
const archivo = localFont({
  src: '../../fonts/archivo-latin-wdth-normal.woff2',
  weight: '100 900',
  style: 'normal',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
  variable: '--font-archivo-var',
});

export default function RootLayoutBase({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Temat sätts av skriptet nedan innan React tar över, så attributet
    // finns i DOM:en men inte i det React renderar.
    <html lang="en" className={`${plexMono.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        {/* Före första ritningen, annars blinkar sidan i Neo innan Kronberg
            slår till. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <meta charSet="UTF-8" />
        {/* Ingen <title> här. En hårdkodad titel hamnade före den som varje
            sida sätter via `metadata`, och länkförhandsvisningar tar den
            första — den publika schemalänken visades som "Drive C" i chattar.
            Appens standardtitel står i `layout.tsx`. */}
      </head>
      <body
        className={`${redHat.className} ${redHat.variable} ${monument.variable} ${bangers.variable} ${archivoBlack.variable} min-h-screen bg-ui-bg`}
      >
        <AuthProvider>
          <main className="pt-8 px-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
