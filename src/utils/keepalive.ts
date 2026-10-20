/**
 * `keepalive` låter ett anrop gå klart efter att sidan stängts. Webbläsaren
 * tillåter högst 64 KiB för alla keepalive-anrop i flykt sammanlagt, inte för
 * vart och ett, och ett anrop över gränsen kastar i stället för att skickas.
 * Temahjulet skickar hjulet och biblioteket samtidigt, och planeraren sin
 * vecka bredvid släppet av låset.
 *
 * Budgeten nedan räknar det som är i flykt härifrån, med lite marginal för
 * andra anrop. Får ett anrop inte plats skickas det utan keepalive: då hinner
 * det fortfarande fram vid sidbyte inom appen, och vid stängning är det inte
 * sämre än förut.
 */
export const KEEPALIVE_BUDGET_BYTES = 60 * 1024;

let inFlightBytes = 0;

/** Storleken i byte, som webbläsaren räknar den. Ett tecken som å är två. */
export const byteLength = (body: string): number => new TextEncoder().encode(body).length;

/**
 * Kör `send` med keepalive om det önskas och ryms i budgeten. Budgeten hålls
 * tills anropet är klart.
 */
export const withKeepalive = async <T,>(
  body: string,
  wanted: boolean,
  send: (keepalive: boolean) => Promise<T>,
): Promise<T> => {
  const bytes = wanted ? byteLength(body) : 0;
  if (!wanted || inFlightBytes + bytes > KEEPALIVE_BUDGET_BYTES) return send(false);
  inFlightBytes += bytes;
  try {
    return await send(true);
  } finally {
    inFlightBytes -= bytes;
  }
};
