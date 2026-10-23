#!/usr/bin/env node
// image-ai-tags.mjs — find and remove AI tags from app icons and logos (owner rule, 2026-10-23): the provenance and
// generator records AI tools attach to images, such as C2PA Content Credentials (Anthropic's file system, OpenAI's
// ChatGPT and gpt-image, Adobe Firefly), IPTC "trainedAlgorithmicMedia" labels in XMP, and text naming the tool.
//
//   node image-ai-tags.mjs check <file or folder>...         lists every image with an AI tag; exit 1 when any has one
//   node image-ai-tags.mjs strip <file or folder>...         removes the AI tags in place; pixels are unchanged
//   node image-ai-tags.mjs strip --all <file or folder>...   also removes other metadata (EXIF, XMP, text), for an icon
//                                                            that should carry nothing but its picture
//
// PNG keeps its picture and color chunks byte for byte (with their CRCs), JPEG its picture and color segments, ICO the
// PNGs inside it; SVG loses <metadata> blocks and comments that name an AI tool. WebP and other formats are checked
// only: re-export them without metadata. Folders skip node_modules, .git, build output, caches, Python environments,
// local/ and private/. Node 20+, no dependencies.
//
// Each project that ships icons or logos keeps an exact copy at scripts/image-ai-tags.mjs and runs `check` in its own
// `npm run check` (its CI has no agent-skills folder). Edit only this source; agent-skills' test fails on a stale copy.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const MARKERS = /c2pa|jumb|contentauth|content credentials|algorithmicmedia|openai|chatgpt|gpt-image|dall-?e|anthropic|claude|codex|copilot|midjourney|firefly|stable diffusion|stability\.ai|gemini|imagen|ideogram|leonardo\.ai|ai[- ]generated/i;
const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'bKGD', 'pHYs', 'sBIT']);
const IMAGE_EXT = /\.(png|svg|jpe?g|ico|webp|gif|avif)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'local', 'private', '.expo', '.state', '.runtime', 'worktrees', '.venv', 'venv', '.cache', '__pycache__', 'site-packages']);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const named = (text) => MARKERS.exec(text)?.[0] || null;

/** The readable text of a PNG chunk, inflating zTXt and compressed iTXt, so a tag inside compressed text is found. */
function pngText(type, d) {
  let text = d.toString('latin1');
  try {
    const k = d.indexOf(0);
    if (type === 'zTXt') text += zlib.inflateSync(d.subarray(k + 2)).toString('utf8');
    if (type === 'iTXt' && d[k + 1] === 1) { let q = d.indexOf(0, k + 3) + 1; q = d.indexOf(0, q) + 1; text += zlib.inflateSync(d.subarray(q)).toString('utf8'); }
  } catch {}
  return text;
}
/** Each format's parts beyond the picture: { label, ai, start, end } (byte ranges) or, for SVG, text matches. */
function pngParts(b) {
  const parts = [];
  for (let i = 8; i + 12 <= b.length; ) {
    const len = b.readUInt32BE(i), type = b.toString('latin1', i + 4, i + 8), end = i + 12 + len;
    if (end > b.length || type === 'IEND') break;
    if (!PNG_KEEP.has(type)) {
      const hit = type === 'caBX' ? 'C2PA Content Credentials' : named(pngText(type, b.subarray(i + 8, end - 4)));
      parts.push({ label: type === 'caBX' ? 'caBX (C2PA Content Credentials)' : `${type}${hit ? ` (names ${hit})` : ''}`, ai: !!hit, start: i, end });
    }
    i = end;
  }
  return parts;
}
function jpegParts(b) {
  const parts = [];
  for (let i = 2; i + 4 <= b.length && b[i] === 0xff; ) {
    const marker = b[i + 1];
    if (marker === 0xda) break; // start of scan: the picture follows
    const end = i + 2 + b.readUInt16BE(i + 2), app = marker >= 0xe0 && marker <= 0xef ? marker - 0xe0 : null;
    if ((app !== null && ![0, 2, 14].includes(app)) || marker === 0xfe) { // keep JFIF, ICC color, Adobe color
      const hit = named(b.toString('latin1', i + 4, end)) || (app === 11 ? 'C2PA' : null); // APP11 holds JUMBF, i.e. C2PA
      parts.push({ label: `${marker === 0xfe ? 'COM' : `APP${app}`}${hit ? ` (names ${hit})` : ''}`, ai: !!hit, start: i, end });
    }
    i = end;
  }
  return parts;
}
const without = (b, head, parts) => { const out = [b.subarray(0, head)]; let at = head; for (const p of parts) { out.push(b.subarray(at, p.start)); at = p.end; } out.push(b.subarray(at)); return Buffer.concat(out); };
function icoImages(b) {
  const out = [];
  for (let k = 0; k < b.readUInt16LE(4); k++) { const e = 6 + k * 16; out.push(b.subarray(b.readUInt32LE(e + 12), b.readUInt32LE(e + 12) + b.readUInt32LE(e + 8))); }
  return out;
}
// An SVG's removable parts. Only <metadata> goes under --all; a comment or namespace goes only when it names an AI tool
// (C2PA leaves xmlns:c2pa="http://c2pa.org/manifest" on the root element beside its metadata block).
const SVG_PARTS = [[/<metadata\b[\s\S]*?<\/metadata>\s*/gi, '<metadata> block'], [/<!--[\s\S]*?-->\s*/g, 'comment'], [/\s+xmlns:[\w.-]+\s*=\s*("[^"]*"|'[^']*')/g, 'namespace']];

function formatOf(b, file) {
  if (b.subarray(0, 8).equals(PNG_SIG)) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b.length >= 6 && b.readUInt16LE(0) === 0 && b.readUInt16LE(2) === 1 && /\.ico$/i.test(file)) return 'ico';
  if (/\.svg$/i.test(file)) return 'svg';
  return 'other';
}
/**
 * What one image carries beyond its picture: { format, found: [{ label, ai }], unresolved }. found lists every removable
 * part, ai marking an AI tag; unresolved names an AI tool mentioned where this tool does not edit (SVG text, WebP).
 */
export function inspect(bytes, file = '') {
  const format = formatOf(bytes, file);
  if (format === 'png') return { format, found: pngParts(bytes).map(({ label, ai }) => ({ label, ai })), unresolved: null };
  if (format === 'jpeg') return { format, found: jpegParts(bytes).map(({ label, ai }) => ({ label, ai })), unresolved: null };
  if (format === 'ico') return { format, found: icoImages(bytes).flatMap((img, k) => img.subarray(0, 8).equals(PNG_SIG) ? pngParts(img).map(p => ({ label: `image ${k + 1}: ${p.label}`, ai: p.ai })) : []), unresolved: null };
  if (format === 'svg') {
    let text = bytes.toString('utf8'); const found = [];
    for (const [re, label] of SVG_PARTS) text = text.replace(re, (m) => { const hit = named(m); if (hit || label === '<metadata> block') found.push({ label: `${label}${hit ? ` (names ${hit})` : ''}`, ai: !!hit }); return hit || label === '<metadata> block' ? '' : m; });
    const left = named(text);
    return { format, found, unresolved: left ? `still mentions "${left}" outside metadata and comments; edit it by hand` : null };
  }
  const left = named(bytes.toString('latin1'));
  return { format, found: [], unresolved: left ? `mentions "${left}"; re-export it without metadata` : null };
}
/** The image with its AI tags removed (all: every part beyond the picture), or null when nothing changes. */
export function strip(bytes, file = '', { all = false } = {}) {
  const format = formatOf(bytes, file), pick = (p) => all || p.ai;
  if (format === 'png') { const drop = pngParts(bytes).filter(pick); return drop.length ? without(bytes, 8, drop) : null; }
  if (format === 'jpeg') { const drop = jpegParts(bytes).filter(pick); return drop.length ? without(bytes, 2, drop) : null; }
  if (format === 'ico') {
    const images = icoImages(bytes).map(img => (img.subarray(0, 8).equals(PNG_SIG) && strip(img, 'x.png', { all })) || img);
    const count = images.length, head = Buffer.from(bytes.subarray(0, 6 + count * 16));
    let offset = head.length;
    images.forEach((img, k) => { head.writeUInt32LE(img.length, 6 + k * 16 + 8); head.writeUInt32LE(offset, 6 + k * 16 + 12); offset += img.length; });
    const out = Buffer.concat([head, ...images]);
    return out.equals(bytes) ? null : out;
  }
  if (format === 'svg') {
    let text = bytes.toString('utf8'); const before = text;
    for (const [re, label] of SVG_PARTS) text = text.replace(re, (m) => named(m) || (all && label === '<metadata> block') ? '' : m);
    return text === before ? null : Buffer.from(text, 'utf8');
  }
  return null;
}
export function* imageFiles(target) {
  const st = fs.statSync(target);
  if (st.isFile()) { if (IMAGE_EXT.test(target)) yield target; return; }
  for (const d of fs.readdirSync(target, { withFileTypes: true })) {
    if (d.isDirectory() && !SKIP_DIRS.has(d.name)) yield* imageFiles(path.join(target, d.name));
    else if (d.isFile() && IMAGE_EXT.test(d.name)) yield path.join(target, d.name);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), all = args.includes('--all'), [mode, ...targets] = args.filter(a => a !== '--all');
  if (!['check', 'strip'].includes(mode) || !targets.length) { console.error('Usage: node image-ai-tags.mjs check|strip [--all] <file or folder>...'); process.exit(2); }
  let files = 0, tagged = 0, other = 0, cleaned = 0;
  for (const t of targets) for (const file of imageFiles(t)) {
    files++;
    const bytes = fs.readFileSync(file), r = inspect(bytes, file), ai = r.found.filter(p => p.ai);
    if (ai.length || r.unresolved) tagged++; else if (r.found.length) other++;
    if (mode === 'strip') {
      const out = strip(bytes, file, { all });
      if (out) { fs.writeFileSync(file, out); cleaned++; console.log(`CLEANED ${file} · ${r.found.filter(p => all || p.ai).map(p => p.label).join(', ')}`); }
      if (r.unresolved) console.log(`LEFT    ${file} · ${r.unresolved}`);
    } else if (ai.length || r.unresolved) console.log(`AI TAG  ${file} · ${[...ai.map(p => p.label), r.unresolved].filter(Boolean).join(', ')}`);
  }
  console.log(`${files} image${files === 1 ? '' : 's'} checked: ${tagged} with AI tags, ${other} with other metadata only (not AI; strip --all removes it)${mode === 'strip' ? `; ${cleaned} cleaned` : ''}.`);
  process.exitCode = mode === 'check' && tagged ? 1 : 0;
}
