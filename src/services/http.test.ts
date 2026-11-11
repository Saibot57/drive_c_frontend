import { describe, expect, it } from 'vitest';
import { readData } from './http';

const response = (status: number, body: unknown, json = true) =>
  ({ ok: status < 400, status, json: async () => { if (!json) throw new Error('inte json'); return body; } }) as unknown as Response;

describe('readData', () => {
  it('ger data när svaret lyckats', async () => {
    await expect(readData(response(200, { success: true, data: [1, 2] }), 'fel')).resolves.toEqual([1, 2]);
  });

  it('kastar serverns fel när success är false, även med status 200', async () => {
    await expect(readData(response(200, { success: false, error: 'Kartan finns inte' }), 'fel')).rejects.toThrow('Kartan finns inte');
  });

  it('kastar reservtexten när svaret saknar fel eller inte är JSON', async () => {
    await expect(readData(response(500, { success: false }), 'Kunde inte hämta')).rejects.toThrow('Kunde inte hämta');
    await expect(readData(response(502, null, false), 'Kunde inte hämta')).rejects.toThrow('Kunde inte hämta');
  });
});
