// Turns MAPA's AGROFIT open-data export ("Produto Formulado", one row per product × crop × pest)
// into the app's product catalog: one entry per registration, active registrations only.

export const SOURCE_URL =
  'https://dados.agricultura.gov.br/dataset/6c913699-e82e-4da3-a0a1-fb6c431e367f/resource/d30b30d7-e256-484e-9ab8-cd40974e1238/download/agrofitprodutosformulados.csv';

const REQUIRED = ['NR_REGISTRO', 'MARCA_COMERCIAL', 'FORMULACAO', 'INGREDIENTE_ATIVO', 'TITULAR_DE_REGISTRO', 'CLASSE', 'CLASSE_TOXICOLOGICA', 'CLASSE_AMBIENTAL', 'SITUACAO'];

/** Streaming parser for `;`-separated CSV with RFC 4180 quotes; feed text chunks, get rows. */
export function createCsvParser(onRow, delimiter = ';') {
  let row = [];
  let cell = '';
  let quoted = false;
  let quotePending = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== '') onRow(row);
    row = [];
  };
  return {
    push(text) {
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quotePending) {
          quotePending = false;
          if (ch === '"') {
            cell += '"';
            continue;
          }
          quoted = false;
        }
        if (quoted) {
          if (ch === '"') quotePending = true;
          else cell += ch;
        } else if (ch === '"' && cell.trim() === '') {
          cell = '';
          quoted = true;
        } else if (ch === delimiter) endCell();
        else if (ch === '\n') endRow();
        else if (ch !== '\r') cell += ch;
      }
    },
    end() {
      if (quotePending) quoted = false;
      if (cell !== '' || row.length) endRow();
    },
  };
}

// The export carries Windows-1252 punctuation as C1 control characters (U+0080–U+009F), e.g. "S/A. \x96 Perdizes".
const C1 = new TextDecoder('windows-1252');
const fixC1 = (s) => s.replace(/[\u0080-\u009f]/g, (ch) => C1.decode(new Uint8Array([ch.charCodeAt(0)])));

const clean = (s) => fixC1(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * "Endemic; Protenac" or "Metafort, Celene" → one entry per brand (a registration may carry several).
 * Only ", " splits: "2,4-D" keeps its comma.
 */
export function brands(raw) {
  return [...new Set(clean(raw).split(/;|,\s/).map(clean).filter(Boolean))];
}

/** Collects rows into one product per registration number. */
export function createCatalog() {
  let index = null;
  const products = new Map();
  return {
    add(cells) {
      if (!index) {
        index = Object.fromEntries(cells.map((h, i) => [clean(h).replace(/^﻿/, ''), i]));
        const missing = REQUIRED.filter((h) => !(h in index));
        if (missing.length) throw new Error(`AGROFIT layout changed, missing columns: ${missing.join(', ')}`);
        return;
      }
      const get = (h) => clean(cells[index[h]]);
      if (get('SITUACAO').toUpperCase() !== 'TRUE') return;
      const reg = get('NR_REGISTRO');
      if (!/^\d{1,8}$/.test(reg)) return;
      const known = products.get(reg);
      if (known) {
        for (const b of brands(cells[index.MARCA_COMERCIAL])) if (!known.b.includes(b)) known.b.push(b);
        return;
      }
      const b = brands(cells[index.MARCA_COMERCIAL]);
      if (!b.length) return;
      products.set(reg, {
        r: reg,
        b,
        f: get('FORMULACAO'),
        a: get('INGREDIENTE_ATIVO'),
        h: get('TITULAR_DE_REGISTRO'),
        c: get('CLASSE'),
        t: get('CLASSE_TOXICOLOGICA'),
        e: get('CLASSE_AMBIENTAL'),
      });
    },
    /** Sorted by first brand so the file diffs cleanly between builds. */
    result() {
      return [...products.values()].sort((x, y) => x.b[0].localeCompare(y.b[0], 'pt-BR') || x.r.localeCompare(y.r));
    },
  };
}
