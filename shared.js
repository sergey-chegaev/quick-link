// Link logic and storage, shared by the popup, the settings page and the service worker.

export const SCHEMA_VERSION = 2;

// chrome.storage.sync allows 8192 bytes for one item (key + JSON value).
export const SYNC_ITEM_LIMIT = 8192;

// A URL without {name} has one required variable: the typed value goes at the end.
export const END_VAR = 'value';

const VAR_RE = /\{(\w+)\}/g;

export function isLegacy(url) {
  return !/\{\w+\}/.test(url);
}

/** Splits a URL template into text parts and variable parts. */
export function parseTemplate(url) {
  const parts = [];
  let last = 0;
  for (const m of url.matchAll(VAR_RE)) {
    if (m.index > last) parts.push({ text: url.slice(last, m.index) });
    parts.push({ name: m[1], inQuery: /[?#]/.test(url.slice(0, m.index)) });
    last = m.index + m[0].length;
  }
  if (last < url.length) parts.push({ text: url.slice(last) });
  if (isLegacy(url)) parts.push({ name: END_VAR, inQuery: /[?#]/.test(url) });
  return parts;
}

export function varNames(url) {
  return [...new Set(parseTemplate(url).filter((p) => p.name).map((p) => p.name))];
}

/**
 * Variables in the order of the popup fields and of the address-bar values.
 * link.fieldOrder sets the order. Variables that are not in it follow in template order.
 */
export function fieldNames(link) {
  const names = varNames(link.url);
  const first = [...new Set(link.fieldOrder ?? [])].filter((n) => names.includes(n));
  return [...first, ...names.filter((n) => !first.includes(n))];
}

/** A variable without settings is required. Only an optional variable has a default. */
export function varConfig(link, name) {
  const c = link.vars?.[name];
  return c && c.required === false
    ? { required: false, default: c.default ?? '' }
    : { required: true, default: '' };
}

/** Names of the required variables that have no value. */
export function missingVars(link, values) {
  return fieldNames(link).filter((n) => varConfig(link, n).required && !values[n]);
}

/** Query and fragment values are fully encoded. Path values keep "/". */
export function encodeValue(part, value) {
  const encoded = encodeURIComponent(value);
  return part.inQuery ? encoded : encoded.replace(/%2F/gi, '/');
}

/** An empty optional value uses its default, or adds nothing. */
export function buildUrl(link, values) {
  return parseTemplate(link.url)
    .map((p) => (p.text !== undefined ? p.text : encodeValue(p, values[p.name] || varConfig(link, p.name).default)))
    .join('');
}

/** Splits address-bar text into a keyword and values. */
export function parseCommand(text) {
  const [keyword = '', ...args] = text.trim().split(/\s+/).filter(Boolean);
  return { keyword: keyword.toLowerCase(), args };
}

export function findByKeyword(links, keyword) {
  return keyword ? links.find((l) => l.keyword.toLowerCase() === keyword) : undefined;
}

/**
 * Gives address-bar values to variables. If all values are typed, they go in field order.
 * If fewer values are typed, required variables get them first. The last variable gets the rest of the text.
 */
export function valuesFromArgs(link, args) {
  const names = fieldNames(link);
  const required = names.filter((n) => varConfig(link, n).required);
  const order = args.length >= names.length ? names : [...required, ...names.filter((n) => !required.includes(n))];
  const values = {};
  order.forEach((n, i) => {
    if (i < args.length) values[n] = args[i];
  });
  if (args.length > names.length && names.length) values[names.at(-1)] = args.slice(names.length - 1).join(' ');
  return values;
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Links saved by 0.0.x have only name and url. The other fields get defaults here. */
export function normalizeLink(raw) {
  return {
    name: String(raw?.name ?? ''),
    url: String(raw?.url ?? ''),
    keyword: typeof raw?.keyword === 'string' ? raw.keyword : '',
    vars: isObject(raw?.vars) ? raw.vars : {},
    fieldOrder: Array.isArray(raw?.fieldOrder) ? raw.fieldOrder.filter((n) => typeof n === 'string') : [],
  };
}

/**
 * The stored form: no empty fields, settings only for optional variables that are in the URL,
 * and fieldOrder only when it is not the template order.
 */
export function compactLink(link) {
  const out = { name: link.name, url: link.url };
  if (link.keyword) out.keyword = link.keyword;
  const vars = {};
  for (const n of varNames(link.url)) {
    const c = varConfig(link, n);
    if (!c.required) vars[n] = c.default ? { required: false, default: c.default } : { required: false };
  }
  if (Object.keys(vars).length) out.vars = vars;
  const order = fieldNames(link);
  if (order.join('\n') !== varNames(link.url).join('\n')) out.fieldOrder = order;
  return out;
}

export function storedSize(links) {
  return 'links'.length + new TextEncoder().encode(JSON.stringify(links.map(compactLink))).length;
}

export async function loadLinks() {
  const { links } = await chrome.storage.sync.get('links');
  return Array.isArray(links) ? links.map(normalizeLink) : [];
}

export function saveLinks(links) {
  return chrome.storage.sync.set({ schemaVersion: SCHEMA_VERSION, links: links.map(compactLink) });
}

function setThemeAttribute(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme); // read by theme.js before the page paints
  } catch {
    // The page still works without the cached value.
  }
}

export async function applySavedTheme() {
  const { theme = 'system' } = await chrome.storage.sync.get('theme');
  setThemeAttribute(theme);
  return theme;
}

export async function saveTheme(theme) {
  setThemeAttribute(theme);
  await chrome.storage.sync.set({ theme });
}

/** Makes a DOM element. Props that start with "on" are event listeners. */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}
