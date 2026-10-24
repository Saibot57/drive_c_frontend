import type {
  ColorTriggerRule,
  PublicLinkDisplayConfig,
  RoomTriggerRule,
} from '@/types/schedule';

export type LocalDisplayRules = {
  colorTriggers: ColorTriggerRule[];
  roomTriggers: RoomTriggerRule[];
};

/** Jämför två uppsättningar regler utan att bry sig om objektens identitet. */
export const rulesSignature = ({ colorTriggers, roomTriggers }: LocalDisplayRules) =>
  JSON.stringify([colorTriggers, roomTriggers]);

/**
 * Visningsinställningarna som skickas när länken skapas, pekas om eller får
 * nya dolda titlar (dataintegritet F16).
 *
 * Färg- och salsreglerna bor i den här webbläsarens localStorage, som inte är
 * knuten till kontot. Förut skickades de med varje gång, så en annan dator
 * med tomma eller andra regler skrev över länkens färger och salar för alla
 * deltagare. Nu skickas de lokala reglerna bara för en ny länk och när de
 * ändrats på den här enheten under sessionen. Annars står serverns kvar.
 *
 * @param saved Länkens inställningar på servern, eller null för en ny länk.
 */
export const displayConfigFor = (
  hiddenTitles: string[],
  saved: PublicLinkDisplayConfig | null,
  local: LocalDisplayRules,
  localChanged: boolean,
): PublicLinkDisplayConfig => {
  const rules = !saved || localChanged ? local : saved;
  return {
    hiddenTitles,
    colorTriggers: rules.colorTriggers,
    roomTriggers: rules.roomTriggers,
  };
};
