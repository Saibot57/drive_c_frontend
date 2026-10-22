// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  CENTERED,
  KEY_STEP_LARGE_PX,
  KEY_STEP_PX,
  MIN_VISIBLE_PX,
  TITLE_VISIBLE_PX,
  clampDialogOffset,
  dialogMoveStep,
  forgetDialogOffsets,
  isDialogDragStart,
  recallDialogOffset,
  rememberDialogOffset,
} from './dialogPosition';

const viewport = { width: 1200, height: 800 };
// En dialog på 500 × 400 mitt i fönstret.
const box = { left: 350, top: 200, width: 500, height: 400 };

describe('clampDialogOffset', () => {
  it('lämnar en förskjutning inom fönstret orörd', () => {
    expect(clampDialogOffset({ x: -200, y: 100 }, box, viewport)).toEqual({ x: -200, y: 100 });
  });

  it('låter inte överkanten hamna ovanför fönstret', () => {
    expect(clampDialogOffset({ x: 0, y: -500 }, box, viewport).y).toBe(-box.top);
  });

  it('låter titelraden synas nertill', () => {
    const { y } = clampDialogOffset({ x: 0, y: 2000 }, box, viewport);
    expect(box.top + y).toBe(viewport.height - TITLE_VISIBLE_PX);
  });

  it('låter en bit av dialogen synas i sidled', () => {
    const left = clampDialogOffset({ x: -5000, y: 0 }, box, viewport);
    expect(box.left + left.x + box.width).toBe(MIN_VISIBLE_PX);
    const right = clampDialogOffset({ x: 5000, y: 0 }, box, viewport);
    expect(box.left + right.x).toBe(viewport.width - MIN_VISIBLE_PX);
  });

  it('tillåter alltid mitten, även när dialogen är högre än fönstret', () => {
    const tall = { left: 350, top: -50, width: 500, height: 900 };
    expect(clampDialogOffset(CENTERED, tall, viewport)).toEqual(CENTERED);
  });

  it('avrundar till hela pixlar', () => {
    expect(clampDialogOffset({ x: 10.6, y: -3.2 }, box, viewport)).toEqual({ x: 11, y: -3 });
  });
});

describe('dialogMoveStep', () => {
  const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }>) => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  });

  it('flyttar med Ctrl+Cmd+pil', () => {
    expect(dialogMoveStep(key('ArrowLeft', { ctrlKey: true, metaKey: true }))).toEqual({ x: -KEY_STEP_PX, y: 0 });
    expect(dialogMoveStep(key('ArrowDown', { ctrlKey: true, metaKey: true }))).toEqual({ x: 0, y: KEY_STEP_PX });
  });

  it('tar ett längre steg med Shift', () => {
    expect(dialogMoveStep(key('ArrowUp', { ctrlKey: true, metaKey: true, shiftKey: true }))).toEqual({
      x: 0,
      y: -KEY_STEP_LARGE_PX,
    });
  });

  it('flyttar med Ctrl+Alt+pil utanför Mac', () => {
    expect(dialogMoveStep(key('ArrowRight', { ctrlKey: true, altKey: true }))).toEqual({ x: KEY_STEP_PX, y: 0 });
  });

  it('lämnar Cmd+pil och Ctrl+pil åt textfälten', () => {
    expect(dialogMoveStep(key('ArrowLeft', { metaKey: true }))).toBeNull();
    expect(dialogMoveStep(key('ArrowLeft', { ctrlKey: true }))).toBeNull();
    expect(dialogMoveStep(key('ArrowLeft', { ctrlKey: true, metaKey: true, altKey: true }))).toBeNull();
    expect(dialogMoveStep(key('a', { ctrlKey: true, metaKey: true }))).toBeNull();
  });
});

describe('minnet', () => {
  afterEach(forgetDialogOffsets);

  it('minns platsen per dialog', () => {
    rememberDialogOffset('Redigera post', { x: 300, y: -40 });
    expect(recallDialogOffset('Redigera post')).toEqual({ x: 300, y: -40 });
    expect(recallDialogOffset('Ny byggsten')).toEqual(CENTERED);
  });

  it('glömmer en dialog som lagts tillbaka i mitten', () => {
    rememberDialogOffset('Redigera post', { x: 300, y: -40 });
    rememberDialogOffset('Redigera post', CENTERED);
    expect(recallDialogOffset('Redigera post')).toEqual(CENTERED);
  });
});

describe('isDialogDragStart', () => {
  const setup = () => {
    document.body.innerHTML = `
      <div id="dialog">
        <div data-dialog-handle><h2 id="title">Redigera post</h2><button id="close">x</button></div>
        <p id="text">Text</p>
        <input id="field" />
      </div>
      <div id="outside"></div>`;
    const dialog = document.getElementById('dialog')!;
    // jsdom räknar inte ut storlekar: en ruta på 500 × 400 utan rullningslist.
    dialog.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 400 }) as DOMRect;
    Object.defineProperty(dialog, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(dialog, 'clientHeight', { value: 400 });
    return dialog;
  };
  const at = { clientX: 100, clientY: 100 };
  const el = (id: string) => document.getElementById(id);

  it('drar i titelraden', () => {
    const dialog = setup();
    expect(isDialogDragStart(el('title'), dialog, at)).toBe(true);
  });

  it('drar i dialogens tomma kant', () => {
    const dialog = setup();
    expect(isDialogDragStart(dialog, dialog, at)).toBe(true);
  });

  it('drar inte i knappar, fält eller text i innehållet', () => {
    const dialog = setup();
    expect(isDialogDragStart(el('close'), dialog, at)).toBe(false);
    expect(isDialogDragStart(el('field'), dialog, at)).toBe(false);
    expect(isDialogDragStart(el('text'), dialog, at)).toBe(false);
  });

  it('drar inte utanför dialogen', () => {
    const dialog = setup();
    expect(isDialogDragStart(el('outside'), dialog, at)).toBe(false);
  });

  it('drar inte i dialogens rullningslist', () => {
    const dialog = setup();
    Object.defineProperty(dialog, 'clientWidth', { value: 485 });
    expect(isDialogDragStart(dialog, dialog, { clientX: 490, clientY: 100 })).toBe(false);
  });
});
