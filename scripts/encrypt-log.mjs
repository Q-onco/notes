#!/usr/bin/env node
// Usage: node scripts/encrypt-log.mjs <plaintext-content-or-file> [output.enc]
// Passphrase read from QONCO_KEY env var.
// If first arg is a file path that exists, reads it. Otherwise treats it as raw text.
// Outputs encrypted blob to [output.enc] or prints to stdout.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { encryptText } from './crypto-utils.mjs';

const key = process.env.QONCO_KEY;
if (!key) { console.error('QONCO_KEY env var not set'); process.exit(1); }

const input = process.argv[2];
if (!input) { console.error('Usage: node scripts/encrypt-log.mjs <file-or-text> [output.enc]'); process.exit(1); }

const text = existsSync(input) ? readFileSync(input, 'utf8') : input;
const enc  = await encryptText(text, key);

const out = process.argv[3];
if (out) {
  writeFileSync(out, enc, 'utf8');
  console.log(`Encrypted → ${out}`);
} else {
  process.stdout.write(enc);
}
