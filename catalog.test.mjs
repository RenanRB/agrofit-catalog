import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brands, createCatalog, createCsvParser } from './catalog.mjs';

const HEADER = 'NR_REGISTRO;MARCA_COMERCIAL;FORMULACAO;INGREDIENTE_ATIVO;TITULAR_DE_REGISTRO;CLASSE;MODO_DE_ACAO;CULTURA;PRAGA_NOME_CIENTIFICO;PRAGA_NOME_COMUM;EMPRESA_PAIS_TIPO;CLASSE_TOXICOLOGICA;CLASSE_AMBIENTAL;ORGANICOS;SITUACAO';

function build(text, chunk = 7) {
  const catalog = createCatalog();
  const parser = createCsvParser((row) => catalog.add(row));
  for (let i = 0; i < text.length; i += chunk) parser.push(text.slice(i, i + chunk));
  parser.end();
  return catalog.result();
}

test('one product per registration, brands merged, inactive dropped', () => {
  const csv = [
    HEADER,
    '35226 ;" Endemic; Protenac";SC - Suspensão Concentrada;Bacillus (20 g/L);Inflora;Fungicida;seletivo;Todas;X;Mofo;(a);Categoria 5;Pouco Perigoso;OUTROS;TRUE',
    '35226;Endemic;SC - Suspensão Concentrada;Bacillus (20 g/L);Inflora;Fungicida;seletivo;Soja;Y;"Mofo;\nbranco";(a);Categoria 5;Pouco Perigoso;OUTROS;TRUE',
    '100;Velho;EC;X;Y;Herbicida;;Soja;Z;W;(a);Categoria 4;Perigoso;NAO;FALSE',
    '200;"Marca ""Aspas""";WG;Z;H;Inseticida;;Milho;Z;W;(a);Categoria 3;Muito Perigoso;NAO;TRUE',
  ].join('\r\n');
  const out = build(csv);
  assert.deepEqual(out.map((p) => p.r), ['35226', '200']);
  assert.deepEqual(out[0].b, ['Endemic', 'Protenac']);
  assert.equal(out[0].h, 'Inflora');
  assert.equal(out[1].b[0], 'Marca "Aspas"');
  assert.equal(out[1].t, 'Categoria 3');
});

test('a changed layout fails loudly', () => {
  assert.throws(() => build('NR_REGISTRO;MARCA\n1;A\n'), /missing columns/);
});

test('brands trims, dedupes and splits on "; " and ", " but not inside "2,4-D"', () => {
  assert.deepEqual(brands('  A ;B; A;; '), ['A', 'B']);
  assert.deepEqual(brands('Metafort, Celene,Cialist'), ['Metafort', 'Celene,Cialist']);
  assert.deepEqual(brands('2,4-D + Picloram CAC'), ['2,4-D + Picloram CAC']);
});

test('Windows-1252 punctuation stored as C1 characters is repaired', () => {
  const csv = HEADER + '\n1;X;SC;Y;Bem Brasil S/A. \u0096 Perdizes/MG;Herbicida;;Soja;Z;W;(a);Categoria 4 \u0096 Pouco Tóxico;E;NAO;TRUE\n';
  const [p] = build(csv);
  assert.equal(p.h, 'Bem Brasil S/A. – Perdizes/MG');
  assert.equal(p.t, 'Categoria 4 – Pouco Tóxico');
});
