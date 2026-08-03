import { readFile } from 'node:fs/promises';
import { BonusImportSchema, type BonusImport } from '../../../schema/imports.js';
import type { SourceAdapter } from '../../types.js';
import { decodeHtmlEntities, titleCase } from '../decode.js';
import { readMatchdayNumber2013 } from './lineup.js';

const LABEL_TO_CODE: Record<string, string> = {
  Ammonito: 'ammonizione',
  Assist: 'assist',
  'Assist da fermo': 'assist_fermo',
  Autogol: 'autogol',
  Espulso: 'espulsione',
  'Gol segnato': 'gol_fatto',
  'Gol subito': 'gol_subito',
  'Rigore Parato': 'rigore_parato',
  'Rigore Sbagliato': 'rigore_sbagliato',
  'Rigore Segnato': 'rigore_segnato',
};

const IGNORED_LABELS = new Set(['Entrato', 'Gol Pareggio', 'Gol Vittoria', 'Uscito']);

function playerNameFromCell(cellHtml: string): string {
  const name = cellHtml.split(/<img\b/i, 1)[0] ?? '';
  return titleCase(decodeHtmlEntities(name.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()));
}

function bonusCodesFromCell(cellHtml: string, playerName: string): string[] {
  const codes: string[] = [];
  const altPattern = /\balt="([^"]*)"/gi;
  let altMatch: RegExpExecArray | null;
  while ((altMatch = altPattern.exec(cellHtml))) {
    const label = decodeHtmlEntities(altMatch[1]!);
    const code = LABEL_TO_CODE[label];
    if (code) {
      codes.push(code);
      continue;
    }
    if (!IGNORED_LABELS.has(label)) {
      throw new Error(`Tipo di bonus/malus non riconosciuto per "${playerName}": "${label}"`);
    }
  }
  return codes;
}

function sameCodes(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((code, index) => code === right[index]);
}

export class Html2013BonusAdapter implements SourceAdapter<BonusImport> {
  constructor(
    private readonly seasonSlug: string,
    private readonly competitionSlug: string,
  ) {}

  canHandle(input: unknown): boolean {
    return typeof input === 'string' && input.toLowerCase().endsWith('.html');
  }

  async parse(input: unknown): Promise<BonusImport> {
    if (typeof input !== 'string') {
      throw new Error('Html2013BonusAdapter si aspetta un path file (string)');
    }
    const html = await readFile(input, 'utf-8');
    const matchdayNumber = readMatchdayNumber2013(html, input);
    const byPlayer = new Map<string, string[]>();
    const playerPattern = /<td\b[^>]*class="player"[^>]*>([\s\S]*?)<\/td>/gi;
    let playerMatch: RegExpExecArray | null;
    while ((playerMatch = playerPattern.exec(html))) {
      const playerName = playerNameFromCell(playerMatch[1]!);
      if (!playerName) throw new Error(`Nome giocatore vuoto in ${input}`);
      const bonusCodes = bonusCodesFromCell(playerMatch[1]!, playerName);
      const existing = byPlayer.get(playerName);
      if (existing && !sameCodes(existing, bonusCodes)) {
        throw new Error(
          `Bonus incoerenti per "${playerName}" nella stessa giornata: [${existing.join(', ')}] vs [${bonusCodes.join(', ')}]`,
        );
      }
      if (!existing) byPlayer.set(playerName, bonusCodes);
    }

    if (byPlayer.size === 0) throw new Error(`Nessun giocatore trovato in ${input}`);

    return BonusImportSchema.parse({
      seasonSlug: this.seasonSlug,
      competitionSlug: this.competitionSlug,
      matchdayNumber,
      players: [...byPlayer.entries()].map(([playerName, bonusCodes]) => ({ playerName, bonusCodes })),
    });
  }
}