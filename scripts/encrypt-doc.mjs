#!/usr/bin/env node
// Usage: node scripts/encrypt-doc.mjs <input-file> <output.enc>
import { readFileSync, writeFileSync } from 'node:fs';
import { encryptText } from './crypto-utils.mjs';

const key = process.env.QONCO_KEY;
if (!key) { console.error('QONCO_KEY env var not set'); process.exit(1); }
const [,, src, dest] = process.argv;
if (!src || !dest) { console.error('Usage: node scripts/encrypt-doc.mjs <src> <dest.enc>'); process.exit(1); }
const text = readFileSync(src, 'utf8');
const enc  = await encryptText(text, key);
writeFileSync(dest, enc, 'utf8');
console.log(`Encrypted ${src} → ${dest}`);
