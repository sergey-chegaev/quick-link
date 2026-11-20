import {
  SCHEMA_VERSION, SYNC_ITEM_LIMIT, applySavedTheme, compactLink, encodeValue, fieldNames, h, isLegacy,
  loadLinks, missingVars, normalizeLink, parseTemplate, saveLinks, saveTheme, storedSize, varConfig,
} from './shared.js';

const $ = (id) => document.getElementById(id);
const SAVED = 'Saved automatically. Synced with your Chrome profile.';
const AVATAR_COLORS = ['#1D4ED8', '#3F3F46', '#B45309', '#047857', '#BE185D', '#65358C', '#0E7490', '#9333EA'];

let links = await loadLinks();
let sel = links.length ? 0 : -1;
const tryValues = new WeakMap(); // link -> values typed in "Try it"
const cur = () => links[sel];

$('theme').value = await applySavedTheme();
renderShortcut();
renderList();
renderEditor();
renderStorage();

// ---------- Saving ----------

let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
  renderStorage();
}

async function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  renderStorage();
  try {
    await saveLinks(links);
    setStatus(SAVED);
  } catch (err) {
    setStatus(`Not saved: ${err.message}`, true);
  }
}

function setStatus(text, isError = false) {
  $('save-status').textContent = text;
  $('save-status').classList.toggle('error', isError);
}

// Do not lose the last change when the user closes the tab within the save delay.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && saveTimer) save();
});

// ---------- General settings ----------

// Chrome lets only the user set the shortcut, on its shortcuts page.
async function renderShortcut() {
  const commands = await chrome.commands.getAll();
  const key = commands.find((c) => c.name === '_execute_action')?.shortcut || '';
  $('shortcut').textContent = key;
  $('shortcut').hidden = !key;
  $('shortcut-none').hidden = !!key;
  $('shortcut-button').textContent = key ? 'Change' : 'Set shortcut';
}

$('shortcut-button').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
window.addEventListener('focus', renderShortcut); // the user comes back from the shortcuts page

$('theme').addEventListener('change', (e) => saveTheme(e.target.value));

$('export').addEventListener('click', () => {
  const json = JSON.stringify({ schemaVersion: SCHEMA_VERSION, links: links.map(compactLink) }, null, 2);
  const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'quick-link-backup.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('import').addEventListener('click', () => $('import-file').click());

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data?.links;
    if (!Array.isArray(list) || !list.every((l) => typeof l?.name === 'string' && typeof l?.url === 'string')) {
      throw new Error('the file has no list of links with a name and a URL.');
    }
    if (!confirm(`Replace your ${links.length} links with the ${list.length} links from the file?`)) return;
    links = list.map(normalizeLink);
    sel = links.length ? 0 : -1;
    renderList();
    renderEditor();
    await save();
  } catch (err) {
    setStatus(`Import failed: ${err.message}`, true);
  }
});

function renderStorage() {
  const bytes = storedSize(links);
  const pct = Math.min(100, Math.round((bytes / SYNC_ITEM_LIMIT) * 100));
  $('meter-bar').style.width = `${pct}%`;
  $('meter-bar').classList.toggle('full', pct > 80);
  $('meter').setAttribute('aria-valuenow', bytes);
  const perLink = links.length ? bytes / links.length : 150;
  const more = Math.max(0, Math.floor((SYNC_ITEM_LIMIT - bytes) / perLink));
  $('storage-note').textContent = `${(bytes / 1024).toFixed(1)} KB of 8 KB used. About ${more} more links fit.`;
}

// ---------- Links list ----------

let dragFrom = -1;

function avatarColor(name) {
  let sum = 0;
  for (const ch of name) sum += ch.codePointAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function renderList() {
  $('count').textContent = links.length;
  $('rows').replaceChildren(...links.map((link, i) => {
    const row = h('li', {
      class: i === sel ? 'row selected' : 'row',
      ondragover: (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        row.classList.add('over');
      },
      ondragleave: () => row.classList.remove('over'),
      ondrop: (e) => {
        e.preventDefault();
        moveLink(dragFrom, i);
      },
    },
    h('span', {
      class: 'grip',
      draggable: 'true',
      title: 'Drag to reorder',
      ondragstart: (e) => {
        dragFrom = i;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
        row.classList.add('dragging');
      },
      ondragend: () => {
        dragFrom = -1;
        renderList();
      },
    }),
    h('button', {
      type: 'button',
      class: 'pick',
      'aria-current': i === sel ? 'true' : null,
      onclick: () => {
        select(i);
        focusRow(i);
      },
      onkeydown: (e) => {
        if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        const to = i + (e.key === 'ArrowUp' ? -1 : 1);
        moveLink(i, to);
        focusRow(to >= 0 && to < links.length ? to : i);
      },
    },
    h('span', { class: 'avatar', style: `background:${avatarColor(link.name)}`, 'aria-hidden': 'true' },
      (link.name.trim()[0] || '?').toUpperCase()),
    h('span', { class: 'row-name' }, link.name || 'Untitled'),
    link.keyword && h('span', { class: 'chip' }, link.keyword)));
    return row;
  }));
}

// The list is drawn again after each change, so the focus must go back to the row.
function focusRow(i) {
  $('rows').children[i]?.querySelector('.pick').focus();
}

function moveLink(from, to) {
  if (from < 0 || to < 0 || to >= links.length || from === to) return renderList();
  const selected = cur();
  const [moved] = links.splice(from, 1);
  links.splice(to, 0, moved);
  sel = links.indexOf(selected);
  renderList();
  save();
}

function select(i) {
  sel = i;
  renderList();
  renderEditor();
}

$('add').addEventListener('click', () => {
  links.push(normalizeLink({ name: 'New link', url: 'https://' }));
  select(links.length - 1);
  scheduleSave();
  $('name').focus();
  $('name').select();
});

// ---------- Editor ----------

function renderEditor() {
  const link = cur();
  $('no-links').hidden = !!link;
  $('form').hidden = !link;
  if (!link) return;
  $('name').value = link.name;
  $('keyword').value = link.keyword;
  $('url').value = link.url;
  renderChecks();
  renderTemplate();
}

$('name').addEventListener('input', (e) => {
  cur().name = e.target.value;
  renderList();
  scheduleSave();
});

$('keyword').addEventListener('input', (e) => {
  const keyword = e.target.value.replace(/\s+/g, ''); // the address bar splits words at spaces
  if (keyword !== e.target.value) e.target.value = keyword;
  cur().keyword = keyword;
  renderList();
  renderChecks();
  scheduleSave();
});

$('url').addEventListener('input', (e) => {
  cur().url = e.target.value;
  renderChecks();
  renderTemplate();
  scheduleSave();
});

$('convert').addEventListener('click', () => {
  cur().url += `{value}`;
  $('url').value = cur().url;
  renderTemplate();
  scheduleSave();
});

$('delete').addEventListener('click', () => {
  if (!confirm(`Delete "${cur().name || 'this link'}"?`)) return;
  links.splice(sel, 1);
  sel = Math.min(sel, links.length - 1);
  renderList();
  renderEditor();
  save();
});

function setHelp(id, text, isError) {
  $(`${id}-help`).textContent = text;
  $(`${id}-help`).classList.toggle('error', isError);
  $(id).setAttribute('aria-invalid', String(isError));
}

function renderChecks() {
  const link = cur();
  const keyword = link.keyword.toLowerCase();
  const clash = keyword && links.find((l) => l !== link && l.keyword.toLowerCase() === keyword);
  setHelp('keyword', clash
    ? `Already used by ${clash.name || 'another link'}`
    : `Type in the address bar: ql ${link.keyword || 'keyword'} …`, !!clash);
  const urlOk = /^https?:\/\/\S/.test(link.url);
  setHelp('url', urlOk
    ? 'Write {name} where a value goes. You can use more than one variable.'
    : 'The URL must start with https:// or http://', !urlOk);
}

function renderTemplate() {
  const link = cur();
  const legacy = isLegacy(link.url);
  $('url-preview').replaceChildren(...parseTemplate(link.url)
    .filter((p) => !(legacy && p.name))
    .map((p) => (p.name ? h('span', { class: 'seg var' }, `{${p.name}}`) : h('span', { class: 'seg' }, p.text))));
  $('legacy').hidden = !legacy;
  $('vars').hidden = legacy;
  const names = fieldNames(link);
  $('vars-rows').replaceChildren(...(legacy ? [] : names.map((n, k) => varRow(link, n, k, names.length))));
  renderTry();
}

// Moves a variable up or down in the field order, then keeps the focus on the same button.
function moveVar(link, name, step, buttonClass) {
  const order = fieldNames(link);
  const from = order.indexOf(name);
  const to = from + step;
  if (to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  link.fieldOrder = order;
  renderTemplate();
  const button = $(`order-${name}`).querySelector(buttonClass);
  (button.disabled ? $(`order-${name}`).querySelector('button:not(:disabled)') : button)?.focus();
  scheduleSave();
}

function varNote(c) {
  if (c.required) return 'The link opens only when this field has a value.';
  return c.default ? `An empty field uses ${c.default}.` : 'An empty field adds nothing to the URL.';
}

function varRow(link, name, index, total) {
  const c = varConfig(link, name);
  const checkId = `required-${name}`;
  const note = h('span', { class: 'hint' }, varNote(c));
  const order = h('span', { class: 'order', id: `order-${name}` },
    h('button', {
      type: 'button',
      class: 'up',
      'aria-label': `Move ${name} up`,
      title: 'Move up',
      disabled: index === 0,
      onclick: () => moveVar(link, name, -1, '.up'),
    }, '↑'),
    h('button', {
      type: 'button',
      class: 'down',
      'aria-label': `Move ${name} down`,
      title: 'Move down',
      disabled: index === total - 1,
      onclick: () => moveVar(link, name, 1, '.down'),
    }, '↓'));
  return h('div', { class: 'var-row' },
    h('span', {}, h('span', { class: 'chip' }, `{${name}}`)),
    h('label', { class: 'check', for: checkId },
      h('input', {
        type: 'checkbox',
        id: checkId,
        checked: c.required,
        onchange: (e) => {
          const vars = { ...link.vars };
          if (e.target.checked) delete vars[name];
          else vars[name] = { required: false, default: '' };
          link.vars = vars;
          renderTemplate();
          $(checkId).focus();
          scheduleSave();
        },
      }),
      'Required'),
    h('input', {
      type: 'text',
      'aria-label': `Default value for ${name}`,
      value: c.default,
      placeholder: c.required ? 'Only for optional' : 'none',
      disabled: c.required,
      spellcheck: 'false',
      oninput: (e) => {
        link.vars = { ...link.vars, [name]: { required: false, default: e.target.value } };
        note.textContent = varNote(varConfig(link, name));
        renderTry();
        scheduleSave();
      },
    }),
    order,
    note);
}

function renderTry() {
  const link = cur();
  if (!tryValues.has(link)) tryValues.set(link, {});
  const values = tryValues.get(link);
  $('try-fields').replaceChildren(...fieldNames(link).map((n) => {
    const c = varConfig(link, n);
    return h('input', {
      type: 'text',
      'aria-label': `Test value for ${n}`,
      class: c.default ? 'has-default' : null,
      placeholder: c.required ? n : c.default || `${n} (optional)`,
      value: values[n] ?? '',
      spellcheck: 'false',
      oninput: (e) => {
        values[n] = e.target.value.trim();
        renderTryUrl();
      },
    });
  }));
  renderTryUrl();
}

function renderTryUrl() {
  const link = cur();
  const values = tryValues.get(link);
  $('try-url').replaceChildren(...parseTemplate(link.url).map((p) => {
    if (p.text !== undefined) return h('span', { class: 'seg' }, p.text);
    const c = varConfig(link, p.name);
    if (values[p.name]) return h('span', { class: 'seg typed' }, encodeValue(p, values[p.name]));
    if (c.default) return h('span', { class: 'seg default' }, encodeValue(p, c.default));
    return c.required ? h('span', { class: 'seg missing' }, `{${p.name}}`) : null;
  }));
  const missing = missingVars(link, values);
  $('try-note').textContent = missing.length ? `Does not open: type ${missing.join(', ')}.` : 'Opens this URL.';
  $('try-note').className = missing.length ? 'hint error' : 'hint ok';
}
