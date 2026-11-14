# Saturn Backend (Community) — Odoo 20

The Saturn backend chrome for Odoo 20: a
resizable side navigation, a full screen app drawer, pinned apps and a bookmark
workspace, on a dark Inter-based palette.

## What it changes

| Area | Behaviour |
| --- | --- |
| Side navigation | Fixed 243 px panel, resizable by its right edge, collapsible to a 56 px icon rail. Switches between **Apps** (all apps) and **Menu** (current app's sections). Footer switches between **Recent** records and **pinned apps**. |
| Hover flyout | Hovering an app opens a popover with that app's sections in wrapping 203 px cards, nested menus rendered as plain group headers. |
| Navbar | Apps dropdown, brand and section menus are replaced by a single drawer toggle; height 46 px, `#1f2937`. |
| App drawer | Full screen overlay with **Apps** / **Workspace** tabs, *Pinned* and *All Features* panes, squircle app tiles with pin stars, and a search field that filters apps and menus. Also acts as the home screen on `/odoo`. |
| Workspace | Bookmarked views grouped by kind, added from the bookmark button in any control panel. |
| Toolbar | Sidebar mode, colour scheme, activity hub, workspace and command palette. |
| Systray | A second colour scheme toggle. The sidebar is hidden while the drawer is open, so this is the copy that stays reachable from every screen; it is lifted above the drawer on purpose. |

## The dark palette

Odoo 20 **Community still has no working dark colour scheme**, which is easy to miss:

- `ir.http.color_scheme()` returns a hardcoded `"light"`, so
  `web.assets_web_dark` is never served and a scheme switch does nothing;
- that bundle is only `web.assets_web` plus a handful of cosmetic
  `*.dark.scss` patches, so even when served it comes out identical to the
  light one.

So the module ships the palette itself:

- `models/ir_http.py` overrides `color_scheme()` to resolve the scheme from the
  cookie, then the `color_scheme` field on `res.users.settings`, then dark. The
  cookie is what the switch writes for the current browser; the setting is what
  carries the choice to a new browser or past a cookie reset. `session_info()`
  reports the resolved value so the client never re-derives it and cannot
  disagree with the bundle that was actually served;
- `static/src/scss/dark_variables.scss` is **prepended** to
  `web.assets_web_dark`, which puts it ahead of Odoo's `!default` declarations
  and makes it a real variable override. It replaces Odoo's grayscale with the
  Saturn Theme ramp and swaps `$o-white`/`$o-black`; body, borders, sheets,
  inputs, dropdowns, modals and tables all derive from those;
- `static/src/scss/light_variables.scss` does the same for light, prepended to
  `web._assets_primary_variables`. Its values are `!default`, and that is
  load-bearing: the dark bundle *includes* `web.assets_web`, and that include
  runs after `dark_variables.scss`, so plain assignments would overwrite the
  dark palette with the light one. `!default` makes each line a no-op once the
  dark file has claimed the variable.

These two regrade the **views** — lists, forms, sheets, dropdowns, modals — to
the brand grays. Because SCSS resolves at compile time they are fixed for the
whole database, unlike the `--saturn-*` chrome tokens, which are CSS custom
properties and so can be swapped at runtime by the scheme switch.

The chrome follows the same switch. Its colours are **CSS custom properties**,
not SCSS literals, because the sidebar, navbar, flyout and drawer live in the
shared `web.assets_backend` bundle and would otherwise stay dark in light mode:

- `variables.scss` declares the tokens with the **light** values;
- `dark_chrome.scss` is appended to `web.assets_web_dark` and overrides them;
- `saturn-alpha(text, 0.14)` emits `rgba(var(--saturn-text-rgb), 0.14)`, so
  translucent shades resolve per scheme too.

Add a colour by putting it in both files. Anything scheme-dependent that cannot
be expressed as one colour gets its own token pair — `--saturn-icon-active-bg`,
`--saturn-on-accent` and `--saturn-tab-active-bg` exist because those surfaces
invert rather than shift.

Changing the palette needs a **server restart**: Odoo caches compiled bundles in
memory, so editing the SCSS alone is not picked up.

## Install

1. Drop `saturn_backend/` in your addons path.
2. Update the apps list and install **Saturn Backend (Community)**.
3. Restart Odoo. The backend comes up dark; the sidebar's *Switch Scheme*
   button flips the cookie back to light.

Changing the `assets` block of the manifest later requires a module upgrade
(`-u saturn_backend`), since asset declarations are read at load time.

Branding is per company, under *Settings → Companies*: `Sidebar logo`,
`Sidebar logo (compact)` and `App drawer background`. When the background is
empty the drawer falls back to a generated gradient; when a logo is empty the
Saturn Theme wordmark is used.

## The Saturn Theme brand

The backend is Saturn Theme's, not a theme you pick: there is no second skin
and no switch. Applied per the Saturn Theme brand guideline:

- **Grayscale only.** White `#FFFFFF`, Light Gray `#E1E3E4`, Dark Gray `#3C3D3E`,
  Black `#000000`, hairline rule `#C8C8C8`. Black is what an active element is
  painted with in light mode, White in dark mode. The single concession is the
  muted gold `#B68A3E` (`#C99F57` on black), used only where a state has to read
  at a glance — pinned and bookmarked. The guideline allows functional colour in
  working tools; a backend is one, so this is a touch, not a theme.
  App icons keep their own colours: desaturating them would stop apps being
  tellable apart, which is function rather than decoration.
- **Dark by default.** The guideline builds interactive artefacts dark, so the
  module's dark default is the brand default too. Dark means a near-black field
  and light-gray text, not a second palette.
- **Type.** Tier 1 *Be Vietnam Pro* for everything, headings at Medium (500) and
  never Bold, because bold clashes with the logo wordmark — size builds the
  hierarchy. Tier 2 *Archivo Narrow* caps is kept to the drawer's own brand
  headers, and *Roboto Mono* to short labels, which is as outward-facing as the
  backend gets. All three are vendored under `static/src/fonts/`, so the backend
  stays usable without a font CDN and Vietnamese diacritics always render.
- **Flat surfaces.** No gradients, no decorative shadows, no image frames. The
  drawer's blob gradient is replaced with a flat field.
- **The wordmark is never rebuilt.** Both official colourways ship under
  `static/src/img/`; the scheme picks one. A company logo set on `Sidebar logo`
  still wins over it.

Where each part lives: the colours are the `--saturn-*` chrome tokens in
`variables.scss` and `dark_chrome.scss`; the views are regraded by
`light_variables.scss` and `dark_variables.scss` (see *The dark palette*); and
`brand_saturn.scss` carries what is not a colour — the `@font-face` declarations,
the two type tiers and the surface treatment.

## Panels that size themselves off the viewport

Odoo has no side navigation, so several screens decide how many panels to show
from the **viewport** width rather than from the room actually left over. That
assumption holds for stock Odoo and breaks here, because the sidebar has already
taken its share. Two screens get it badly wrong, and both are fixed the same
way — with container queries, so nothing about the sidebar width is hardcoded
and a narrow window or a collapsed sidebar is covered by the same rule.

- **Settings.** `.o_setting_box` goes two-up at the `lg` breakpoint regardless.
  On a ~1000px window with the sidebar dragged wide the two columns come out
  ~190px each and the fixed-width monetary inputs spill out of their box
  (Lunch → *Overdraft* is the clearest case). `.o_settings_container` becomes a
  query container and drops to one column below 700px of container width.
- **Discuss.** Worse, because its channel list and member list are both fixed
  width: on a 960px window with the sidebar at 377px, 300px of channel list plus
  251px of member list leave the thread a **32px** column — one character per
  line. `.o_action_manager` becomes the query container (a plain block wrapper,
  so `inline-size` containment cannot disturb Discuss's own flex layout, and its
  width is exactly the room the action was given). Below 900px the member list
  and its toggle are dropped; below 620px the channel list is capped at 220px.
  The thread goes from 32px to 283px at that geometry.

## State

Per-user preferences live on `res.users.settings`, so they follow the user
across browsers: `color_scheme`, `saturn_nav_mode`, `saturn_sidenav_collapsed`,
`saturn_sidenav_width`, `saturn_pins`, `saturn_bookmarks`. Recently opened records are
kept in `localStorage`, under a key scoped by database and user id — a browser
profile is often shared, and one origin can serve several databases.

## Notes

- The icon font (Remix Icon, Apache-2.0) is vendored under
  `static/lib/remixicon/`; the backend makes no external requests.
- `corner-shape: squircle` is used for the app tiles and nav icons. Browsers
  without it simply render rounded corners.
