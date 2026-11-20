# Quick link

A Chrome extension that opens your link templates with typed values: issues, pull requests, admin pages and more.

## Features

- **Link templates with variables.** Put `{name}` anywhere in the URL, and use more than one variable if necessary: `https://github.com/{repo}/pull/{number}`. A URL without a variable gets the typed value at the end.
- **Required and optional variables.** A link opens only when all its required variables have a value. An optional variable can have a default value. The popup shows the default value in purple italic. If an optional variable has no default and no value, it adds nothing to the URL.
- **Field order.** The order of the fields can be different from the order in the URL. For example, the template `https://my.link.com/{path}/{resource}` can show the `resource` field first.
- **Popup.** One row for each link. No field has focus when the popup opens. Push Tab to go to the first field, and Tab again to go to the next fields.
  - **Enter** opens each link that has a typed value, in new tabs.
  - **Shift+Enter** opens the first link in the current tab and the others in new tabs.
  - If a link with a typed value has no value for a required variable, no link opens, and the popup shows the missing field.
- **Address bar.** Type `ql`, push Space, then a link keyword and the values: `ql pr 4521`.
  - If you type all the values, they go to the variables in field order.
  - If you type fewer values, the required variables get them first.
- **Keyboard shortcut to open the popup.** The extension has no default shortcut. To set one, click **Set shortcut** in the settings. Chrome then opens `chrome://extensions/shortcuts`.
- **Settings page.**
  - Add, edit and delete links.
  - Change the order: drag the grip, or push Alt+↑ / Alt+↓ on a selected link.
  - Set variables to required or optional, and set the order of their fields.
  - Test a link with sample values.
  - Choose a theme: light, dark, or the same as the system.
  - Import and export the links as JSON.

## Install for development

1. Clone this repository.
2. In Chrome, open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the repository folder.

## Data

The extension keeps its data in `chrome.storage.sync`, so the data syncs with the Chrome profile:

```json
{
  "schemaVersion": 2,
  "theme": "system",
  "links": [
    {
      "name": "Pull request",
      "url": "https://github.com/{repo}/pull/{number}",
      "keyword": "pr",
      "vars": { "repo": { "required": false, "default": "acme/api" } },
      "fieldOrder": ["number", "repo"]
    }
  ]
}
```

- **The order of `links` is the order in the popup.**
- **A variable that is not in `vars` is required.**
- **`fieldOrder` is the order of the fields.** It is stored only when it is not the template order. Variables that are not in it follow in template order.
- **Old data needs no conversion.** Links saved by version 0.0.x have only `name` and `url`. The extension reads them as they are.
- **Size limit.** Chrome allows 8 KB for one sync item, and all links are in one item. That is about 40–50 links. The settings page shows the space that is used.
- **Export format.** The JSON export has the same `schemaVersion` and `links` fields.

## Development

- Run the link logic checks:

  ```bash
  node test/shared.test.mjs
  ```

- `images/icon.svg` is the source of the `icon*.png` files. The toolbar uses `toolbar16.png` and `toolbar32.png`: the purple Q with no background.
- `store/` has the Chrome Web Store images: four 1280×800 screenshots and the 440×280 small promo tile. They are not part of the extension package.
- To make the package for the Chrome Web Store, zip only the files that the extension uses:

  ```bash
  zip -r quick-link.zip manifest.json *.html *.js *.css images/*.png
  ```
