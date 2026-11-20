// Address-bar keyword: type "ql", push Space, then a link keyword and values (for example "pr 4521").
import {
  buildUrl, findByKeyword, loadLinks, missingVars, parseCommand, valuesFromArgs,
} from './shared.js';

const HELP = 'Quick link: type a keyword, then the values. Example: pr 4521';

const xml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

chrome.omnibox.setDefaultSuggestion({ description: HELP });

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const links = await loadLinks();
  const { keyword, args } = parseCommand(text);
  const link = findByKeyword(links, keyword);

  if (link) {
    const values = valuesFromArgs(link, args);
    const missing = missingVars(link, values);
    chrome.omnibox.setDefaultSuggestion({
      description: missing.length
        ? `${xml(link.name)}: type ${xml(missing.join(', '))}`
        : `${xml(link.name)}: <url>${xml(buildUrl(link, values))}</url>`,
    });
  } else {
    chrome.omnibox.setDefaultSuggestion({ description: HELP });
  }

  suggest(
    links
      .filter((l) => l.keyword && l !== link && l.keyword.toLowerCase().startsWith(keyword))
      .slice(0, 6)
      .map((l) => ({
        content: `${l.keyword} ${args.join(' ')}`.trim() + ' ',
        description: `<match>${xml(l.keyword)}</match> ${xml(l.name)} <dim>${xml(l.url)}</dim>`,
      })),
  );
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const link = findByKeyword(await loadLinks(), parseCommand(text).keyword);
  if (!link) return;
  const values = valuesFromArgs(link, parseCommand(text).args);
  if (missingVars(link, values).length) return; // the suggestion already says which value is missing
  const url = buildUrl(link, values);
  if (disposition === 'currentTab') chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
});
