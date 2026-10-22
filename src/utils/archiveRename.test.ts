import { describe, expect, it } from 'vitest';
import { checkArchiveRename, MAX_ARCHIVE_NAME_LENGTH } from './archiveRename';

const archive = (id: string, name: string, kind: 'week' | 'base' = 'week') => ({ id, name, kind });

const v35 = archive('a1', 'v.35');
const own = [v35, archive('a2', 'v.36'), archive('a3', 'Bas HT26', 'base')];

describe('checkArchiveRename', () => {
  it('trimmar namnet', () => {
    expect(checkArchiveRename('  v.35 (justerad)  ', v35, own)).toMatchObject({
      name: 'v.35 (justerad)', unchanged: false, problem: null,
    });
  });

  it('samma namn är oförändrat', () => {
    expect(checkArchiveRename(' v.35 ', v35, own)).toMatchObject({ unchanged: true, problem: null });
  });

  it('ett tomt namn är inget problem att visa, bara inget att spara', () => {
    expect(checkArchiveRename('   ', v35, own)).toMatchObject({ name: '', problem: null, lostWeek: null });
  });

  it('nekar ett namn ägaren redan har, även ett basschemas', () => {
    expect(checkArchiveRename('v.36', v35, own).problem).toBe('Du har redan ett schema med det namnet.');
    expect(checkArchiveRename('Bas HT26', v35, own).problem).not.toBeNull();
  });

  it('jämför utan skillnad på stora och små bokstäver', () => {
    expect(checkArchiveRename('V.36', v35, own).problem).not.toBeNull();
    expect(checkArchiveRename('bas ht26', v35, own).problem).not.toBeNull();
  });

  it('schemat krockar inte med sig självt när bara skiftläget byts', () => {
    expect(checkArchiveRename('V.35', v35, own)).toMatchObject({ unchanged: false, problem: null });
  });

  it('nekar ett för långt namn', () => {
    expect(checkArchiveRename('x'.repeat(MAX_ARCHIVE_NAME_LENGTH), v35, own).problem).toBeNull();
    expect(checkArchiveRename('x'.repeat(MAX_ARCHIVE_NAME_LENGTH + 1), v35, own).problem).toMatch(/för långt/);
  });

  describe('veckan i terminsplaneringen', () => {
    it('säger till när det nya namnet tappar veckonumret', () => {
      expect(checkArchiveRename('Matteveckan', v35, own).lostWeek).toBe(35);
    });

    it('säger till när veckonumret blir ett annat', () => {
      expect(checkArchiveRename('v.37', v35, own).lostWeek).toBe(35);
    });

    it('tyst när veckan står kvar, i en annan form', () => {
      expect(checkArchiveRename('Vecka 35 (justerad)', v35, own).lostWeek).toBeNull();
    });

    it('tyst när namnet inte ändras eller är tomt', () => {
      expect(checkArchiveRename('v.35', v35, own).lostWeek).toBeNull();
      expect(checkArchiveRename('', v35, own).lostWeek).toBeNull();
    });

    it('tyst för basscheman, som aldrig föreslås', () => {
      const base = archive('b1', 'Bas v.35', 'base');
      expect(checkArchiveRename('Bas HT', base, [base]).lostWeek).toBeNull();
    });

    it('tyst när det gamla namnet inte hade någon vecka', () => {
      const named = archive('c1', 'Introveckan');
      expect(checkArchiveRename('Intro', named, [named]).lostWeek).toBeNull();
    });
  });
});
