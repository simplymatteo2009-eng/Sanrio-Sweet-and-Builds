import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRICE_TEXT } from './domain.js';

const dataDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const pricesPath = join(dataDirectory, 'prices.json');
const requestsPath = join(dataDirectory, 'requests.json');

function readJson(path, fallback) {
  mkdirSync(dataDirectory, { recursive: true });
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function writeJson(path, value) {
  mkdirSync(dataDirectory, { recursive: true });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, path);
}

export function getPrices() {
  const value = readJson(pricesPath, { text: DEFAULT_PRICE_TEXT });
  return typeof value.text === 'string' ? value.text : DEFAULT_PRICE_TEXT;
}

export function setPrices(text) {
  writeJson(pricesPath, { text });
}

export function getRequests() {
  return readJson(requestsPath, {});
}

export function saveRequests(requests) {
  writeJson(requestsPath, requests);
}