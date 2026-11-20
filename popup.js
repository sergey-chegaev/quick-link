import {
  applySavedTheme, buildUrl, fieldNames, h, loadLinks, missingVars, varConfig,
} from './shared.js';

const main = document.getElementById('links');
const message = document.getElementById('message');
const openSettings = () => chrome.runtime.openOptionsPage();

document.getElementById('settings').addEventListener('click', openSettings);
applySavedTheme();

const links = await loadLinks();
render();

function render() {
  if (!links.length) {
    main.append(h('div', { class: 'empty' },
      h('p', {}, 'No links yet.'),
      h('button', { type: 'button', onclick: openSettings }, 'Add a link in settings')));
    return;
  }
  links.forEach((link, i) => {
    const names = fieldNames(link);
    main.append(h('div', { class: 'row' },
      h('label', { for: `f${i}-0`, title: link.name },
        h('span', { class: 'name' }, link.name),
        link.keyword && h('span', { class: 'kw', title: `Address bar: ql ${link.keyword}` }, link.keyword)),
      h('div', { class: 'fields' }, names.map((n, j) => field(link, i, n, j, names.length > 1)))));
  });
}

function field(link, i, name, j, several) {
  const c = varConfig(link, name);
  const label = several ? `${link.name}, ${name}` : link.name;
  return h('input', {
    type: 'text',
    id: `f${i}-${j}`,
    'data-link': i,
    'data-var': name,
    class: c.default ? 'has-default' : null,
    placeholder: c.required ? name : c.default || `${name} (optional)`,
    title: c.required ? name : c.default ? `${name} (default: ${c.default})` : `${name} (optional)`,
    'aria-label': c.required ? label : c.default ? `${label}, default ${c.default}` : `${label}, optional`,
    autocomplete: 'off',
    spellcheck: 'false',
  });
}

function valuesOf(i) {
  const values = {};
  for (const input of main.querySelectorAll(`input[data-link="${i}"]`)) values[input.dataset.var] = input.value.trim();
  return values;
}

function show(text) {
  message.textContent = text;
  message.hidden = !text;
}

main.addEventListener('input', (e) => {
  e.target.removeAttribute('aria-invalid');
  if (!main.querySelector('[aria-invalid="true"]')) show('');
});

main.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
  e.preventDefault();
  open(e.shiftKey);
});

// Enter opens each link that has a typed value, in new tabs. Shift+Enter puts the first one in the current tab.
// If one of them misses a required value, nothing opens: the popup closes when a tab opens,
// so the user could not see the problem later.
async function open(inCurrentTab) {
  const touched = links
    .map((link, i) => ({ link, i, values: valuesOf(i) }))
    .filter((x) => Object.values(x.values).some(Boolean));
  if (!touched.length) return show('Type a value first.');

  const bad = touched.filter((x) => missingVars(x.link, x.values).length);
  for (const x of bad) {
    for (const n of missingVars(x.link, x.values)) {
      main.querySelector(`input[data-link="${x.i}"][data-var="${n}"]`).setAttribute('aria-invalid', 'true');
    }
  }
  if (bad.length === 1) return show(`${bad[0].link.name} needs ${missingVars(bad[0].link, bad[0].values).join(' and ')}. Nothing opened.`);
  if (bad.length) return show(`${bad.length} links need a required value. Nothing opened.`);

  const urls = touched.map((x) => buildUrl(x.link, x.values));
  // All calls start before the popup closes. In new-tab mode, the last tab gets the focus.
  const calls = urls.map((url, k) => (inCurrentTab && k === 0
    ? chrome.tabs.update({ url })
    : chrome.tabs.create({ url, active: !inCurrentTab && k === urls.length - 1 })));
  await Promise.allSettled(calls);
  window.close();
}
