/**
 * En dag ur schemaplaneraren — en stickling, inte en pekare.
 *
 * Dagen är enheten. "Hela veckan" är fem dagar bredvid varandra, vilket är vad
 * som gör att man kan dra ut onsdagen ur högen och skriva bredvid den.
 *
 * Att det är en fryst kopia löser dessutom ett problem som annars saknar
 * lösning: ett schema har inget id. Ett arkiv är strängen `archive_name` på
 * raderna i `planner_activity`, så en referens hade dött tyst vid ett namnbyte.
 * Här är namnet en etikett och inget annat — byts arkivet namn eller raderas
 * påverkas kortet inte, det tappar bara möjligheten att erbjuda uppdatering.
 */

/** En lektion, med bara det som behövs för att rita och läsa den. */
export interface ScheduleDayEntry {
  instanceId: string;
  title: string;
  /** "08:15" */
  startTime: string;
  endTime: string;
  /** Minuter. Härledd ur tiderna om källan saknar den. */
  duration: number;
  color: string;
  teacher?: string;
  room?: string;
  notes?: string;
}

export interface ScheduleDayContent {
  // ── Härkomst ──
  /** null = det arbetande schemat, som inte ligger i något arkiv. */
  archiveName: string | null;
  /** Vad källan hette vid hämtningen. Etikett, aldrig nyckel. */
  sourceLabel: string;
  capturedAt: string;

  // ── Dagen, fryst ──
  day: string;
  entries: ScheduleDayEntry[];

  /**
   * Tidsfönstret kortet visar, i hela timmar.
   *
   * Ett dygn 08–17 är 1080 px med schemats egen skala, och en dag med lektioner
   * till klockan tolv skulle bli till hälften tom. Fönstret klipps därför till
   * det som används — men det räknas fram för hela importen gemensamt, inte per
   * dag. Annars hade måndagens klockan tio och tisdagens hamnat på olika höjd
   * när dagarna ligger bredvid varandra.
   */
  windowStartHour: number;
  windowEndHour: number;

  /** Timlinjalen tar plats. På en yta med fem dagar räcker det med en. */
  showRuler: boolean;
}
