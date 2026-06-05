#!/usr/bin/env node
// Usage: node scripts/encrypt-doc.mjs <input-file> <output.enc>
import { readFileSync, writeFileSync } from 'node:fs';
import { encryptText } from './crypto-utils.mjs';

const key = 'QONCO_KEY_PLACEHOLDER';
const [,, src, dest] = process.argv;
if (!src || !dest) { console.error('Usage: node scripts/encrypt-doc.mjs <src> <dest.enc>'); process.exit(1); }
const text = readFileSync(src, 'utf8');
const enc  = await encryptText(text, key);
writeFileSync(dest, enc, 'utf8');
console.log(`Encrypted ${src} → ${dest}`);
