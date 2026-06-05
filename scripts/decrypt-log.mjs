#!/usr/bin/env node
// Usage: node scripts/decrypt-log.mjs <file.enc>
// Passphrase read from QONCO_KEY env var.
import { readFileSync } from 'node:fs';
import { decryptText } from './crypto-utils.mjs';

const key = process.env.QONCO_KEY;
if (!key) { console.error('QONCO_KEY env var not set'); process.exit(1); }

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/decrypt-log.mjs <file.enc>'); process.exit(1); }

const blob = readFileSync(file, 'utf8');
const text = await decryptText(blob, key);
process.stdout.write(text);
