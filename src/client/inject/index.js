// Loads the browser-side snippets injected into the app shell.
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

/** Strip line comments and collapse whitespace; these files are tiny. */
const compact = (code) => code.replace(/^\s*\/\/.*$/gm, '').replace(/\n\s*/g, '\n').trim();

export const themeScript = `<script>${compact(read('./theme.js'))}</script>`;
export const linksScript = `<script>${compact(read('./links.js'))}</script>`;
export const fixesStyle = `<style id="pinned-fixes">${read('./fixes.css')}</style>`;
export const headLinks = '<link rel="icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/assets/logo-192.png">';
