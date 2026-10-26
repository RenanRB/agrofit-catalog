// node build.mjs [<local csv>]
// Downloads MAPA's AGROFIT "Produto Formulado" export and writes, only when the product list changed:
//   data/products.json  one entry per active registration (what the app downloads)
//   data/manifest.json  a few bytes the app checks on start: updatedAt, product count, sha256 of products.json
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { SOURCE_URL, createCatalog, createCsvParser } from './catalog.mjs';

const PRODUCTS = new URL('./data/products.json', import.meta.url);
const MANIFEST = new URL('./data/manifest.json', import.meta.url);
const MIN_PRODUCTS = 1000;

async function source(localFile) {
  if (localFile) return createReadStream(localFile);
  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'agrofit-catalog (github.com/RenanRB/agrofit-catalog)' } });
  if (!res.ok) throw new Error(`AGROFIT download failed: HTTP ${res.status}`);
  return Readable.fromWeb(res.body);
}

async function previous() {
  try {
    return JSON.parse(await readFile(PRODUCTS, 'utf8'));
  } catch {
    return null;
  }
}

const catalog = createCatalog();
const parser = createCsvParser((row) => catalog.add(row));
const decoder = new TextDecoder('utf-8');
for await (const chunk of await source(process.argv[2])) parser.push(decoder.decode(chunk, { stream: true }));
parser.push(decoder.decode());
parser.end();

const products = catalog.result();
if (products.length < MIN_PRODUCTS) throw new Error(`Only ${products.length} active products: keeping the published list`);

const old = await previous();
if (old && JSON.stringify(old.products) === JSON.stringify(products)) {
  console.log(`[agrofit] unchanged (${products.length} products), nothing written`);
  process.exit(0);
}

const updatedAt = new Date().toISOString();
const body =
  JSON.stringify({
    version: 1,
    source: { name: 'AGROFIT – Produto Formulado (MAPA, dados abertos)', url: SOURCE_URL, license: 'CC BY', updatedAt },
    products,
  }) + '\n';
const sha256 = createHash('sha256').update(body).digest('hex');
await writeFile(PRODUCTS, body);
await writeFile(MANIFEST, JSON.stringify({ version: 1, updatedAt, products: products.length, sha256, file: 'products.json' }, null, 2) + '\n');
console.log(`[agrofit] ${old ? old.products.length : 0} → ${products.length} products, updatedAt ${updatedAt}`);
