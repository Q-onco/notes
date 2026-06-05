#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { encryptText } from './crypto-utils.mjs';

const key = process.env.QONCO_KEY;
if (!key) { console.error('QONCO_KEY env var not set'); process.exit(1); }
const dir = new URL('../logs/', import.meta.url).pathname;

const files = readdirSync(dir).filter(f => f.endsWith('.md'));
for (const f of files) {
  const inPath  = dir + f;
  const outPath = dir + f.replace(/\.md$/, '.enc');
  const text = readFileSync(inPath, 'utf8');
  const enc  = await encryptText(text, key);
  writeFileSync(outPath, enc, 'utf8');
  unlinkSync(inPath);
  console.log(`  ${f} → ${f.replace(/\.md$/, '.enc')}`);
}
console.log(`Done — ${files.length} logs encrypted`);
