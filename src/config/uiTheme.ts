/**
 * Utseendet. Neo är standard; Kronberg slås på per webbläsare.
 * Se docs/plans/kronberg-tema.md, avsnitt 4.
 */
export type UiTheme = 'neo' | 'kronberg';

export const UI_THEME_KEY = 'app.theme.v1';
export const UI_THEME_PARAM = 'tema';
/** Skickas när temat byts, så att flera växlare på samma sida följer med. */
export const UI_THEME_EVENT = 'app:theme-change';

export const isUiTheme = (value: unknown): value is UiTheme => (
  value === 'neo' || value === 'kronberg'
);

/**
 * Körs i <head> före första ritningen. `?tema=kronberg` eller `?tema=neo` i
 * adressen sparas och gäller sedan utan parametern. Allt är inlindat i try:
 * utan localStorage (privat läge, blockerad lagring) blir det Neo.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(UI_THEME_KEY)};var p=new URLSearchParams(location.search).get(${JSON.stringify(UI_THEME_PARAM)});var t;if(p==='kronberg'||p==='neo'){localStorage.setItem(k,p);t=p}else{t=localStorage.getItem(k)}if(t==='kronberg'){document.documentElement.setAttribute('data-theme','kronberg')}}catch(e){}})();`;
