'use client';

import { useEffect, useRef, useState } from 'react';
import type { HeadingContent } from '../../types/heading.types';
import HeadingToolbar from '../HeadingToolbar';
import {
  HEADING_SIZES,
  HEADING_LEVEL_FONT,
  HEADING_FONT_STACK,
  HEADING_FONT_OPTICAL,
  HEADING_DEFAULT_COLOR,
} from '../../types/constants';

interface HeadingEditorProps {
  content: HeadingContent | null;
  isLocked: boolean;
  /** Styr verktygsraden — den ska bara finnas när rubriken är vald. */
  isSelected: boolean;
  onChange: (content: HeadingContent) => void;
  /** Räknare från högerklickets "Redigera". Ett nytt värde öppnar redigeringen. */
  editSignal?: number;
}

export const DEFAULT_HEADING: HeadingContent = { text: 'Rubrik', level: 1 };

/** Nivån bestämmer om du inte valt något. Se HeadingContent.font. */
export function resolveHeadingFont(content: HeadingContent) {
  return content.font ?? HEADING_LEVEL_FONT[content.level];
}

/** Delas med verktygsraden, som visar en förhandsvisning i rätt typsnitt. */
export function headingTextStyle(content: HeadingContent): React.CSSProperties {
  const font = resolveHeadingFont(content);
  return {
    fontFamily: HEADING_FONT_STACK[font],
    fontSize: HEADING_SIZES[content.level] * HEADING_FONT_OPTICAL[font],
    color: content.color ?? HEADING_DEFAULT_COLOR,
  };
}

export default function HeadingEditor({
  content: raw,
  isLocked,
  isSelected,
  onChange,
  editSignal,
}: HeadingEditorProps) {
  const content: HeadingContent = raw?.level ? raw : DEFAULT_HEADING;
  const ref = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  /*
   * Texten skrivs in i noden för hand i stället för via JSX. En contentEditable
   * som React renderar om under skrivandet flyttar markören till början vid
   * varje tecken — därför skrivs den bara när den skiljer sig, och aldrig
   * medan noden har fokus.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node || node === document.activeElement) return;
    if (node.textContent !== content.text) {
      node.textContent = content.text;
    }
  }, [content.text]);

  useEffect(() => {
    if (!isEditing) return;
    const node = ref.current;
    if (!node) return;
    node.focus();
    // Hela texten markerad vid start: en ny rubrik heter "Rubrik", och det är
    // aldrig det man vill behålla.
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // editSignal finns med för att "Redigera" ska nå fram även på en rubrik som
    // redan är i redigeringsläge men tappat markören. Utan den hade effekten
    // inte körts om, eftersom isEditing redan var true.
  }, [isEditing, editSignal]);

  useEffect(() => {
    if (isLocked) setIsEditing(false);
  }, [isLocked]);

  /*
   * Menyvalet "Redigera" gör samma sak som dubbelklicket. Signalen är odefinierad
   * tills den begärts första gången, så det här öppnar ingenting av sig självt.
   * Ett lås som slår till efter signalen fångas av effekten ovan.
   */
  useEffect(() => {
    if (editSignal === undefined) return;
    setIsEditing(true);
  }, [editSignal]);

  return (
    <>
      {isSelected && !isLocked && (
        <HeadingToolbar content={content} onChange={onChange} />
      )}

    <div
      ref={ref}
      className={`ws-heading${isEditing ? ' ws-heading--editing' : ''}`}
      style={headingTextStyle(content)}
      contentEditable={isEditing}
      suppressContentEditableWarning
      spellCheck={false}
      /*
       * Dubbelklick öppnar redigeringen i stället för att texten alltid är
       * skrivbar. Kortets drag ligger på föräldern och stoppar inte
       * standardbeteendet, så en alltid skrivbar rubrik hade betytt att varje
       * försök att markera ord i stället drog iväg hela rubriken.
       */
      onDoubleClick={() => {
        if (!isLocked) setIsEditing(true);
      }}
      // Under redigering hör pekaren till texten, inte till dragningen.
      onPointerDown={(e) => {
        if (isEditing) e.stopPropagation();
      }}
      onInput={(e) => onChange({ ...content, text: e.currentTarget.textContent ?? '' })}
      onBlur={() => setIsEditing(false)}
      onKeyDown={(e) => {
        // Escape och Enter avslutar. useHotkeys släpper ändå inte igenom dem
        // härifrån, eftersom noden är contentEditable.
        if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      title={isLocked ? undefined : 'Dubbelklicka för att redigera'}
    />
    </>
  );
}
