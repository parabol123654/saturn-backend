# Saturn Backend (Community) — Odoo 14

The Saturn backend chrome for Odoo 14: a
resizable side navigation, a full screen app drawer, pinned apps and a bookmark
workspace, on a dark grayscale palette.

## What it changes

| Area | Behaviour |
| --- | --- |
| Side navigation | Fixed 243 px panel, resizable by its right edge, collapsible to a 56 px icon rail. Switches between **Apps** (all apps) and **Menu** (current app's sections). Footer switches between **Recent** records and **pinned apps**. |
| Hover flyout | Hovering an app opens a panel with that app's sections in wrapping 203 px cards, nested menus rendered as plain group headers. It opens downwards from the row, or upwards from a low row, and its height is capped by the room on that side so the cards spill into another column instead of off the screen. |
| Navbar | Apps dropdown, brand and section menus are replaced by a single drawer toggle; height 46 px. |
| App drawer | Full screen overlay with **Apps** / **Workspace** tabs, *Pinned* and *All Features* panes, squircle app tiles with pin stars, and a search field that filters apps and menus. |
| Workspace | Bookmarked views grouped by kind, added from the bookmark button in any control panel. |
| Toolbar | Sidebar mode, colour scheme, activity hub, workspace and search. Odoo 14 has no command palette, so the *Commands* and *Search a menu* buttons open the drawer on its search box, which finds apps and menus by name. |
| Systray | A second colour scheme toggle. The sidebar is hidden while the drawer is open, so this is the copy that stays reachable from every screen; it is lifted above the drawer on purpose. |

## How it plugs into Odoo 14

Odoo 14 still runs the **legacy web client** (`web.WebClient`, `odoo.define`
modules), with Owl 1 only used for a few components such as the control panel.
There are no services, no main-components registry and no popover service, so:

- `static/src/js/saturn.js` is a plain module holding the shared state, with an
  Owl `EventBus` the components re-render on;
- `static/src/js/web_client.js` extends `web.WebClient`: once the menus are
  loaded it hands the menu tree to the state and mounts the sidebar, the flyout
  and the drawer (Owl 1 components, `static/src/js/sidenav.js` and
  `island.js`) on the body. It forwards the current app
  (`change_menu_section`), the displayed action (`current_action_updated`) and
  URL changes (`do_push_state`, which feeds the recents);
- menus are opened through the web client's own `on_app_clicked` /
  `on_menu_clicked`, so breadcrumbs, the `#action=…&menu_id=…` URL and the
  current app behave exactly as with the stock menu;
- the bookmark star is added to the Owl control panel through its
  `patchMixin`, the systray switch is a legacy `SystrayMenu` widget, and the
  sidebar brings its own drag handle, since Odoo 14 has no resizable panel.

Bundles are QWeb templates in this version (`views/assets.xml`), and client
templates are listed under the manifest's `qweb` key.

Odoo 14 ships **Bootstrap 4** on a 12px root font size. The chrome's markup is
shared with the later versions of the module, so `compat_bs4.scss` provides the
Bootstrap 5 utilities it uses (`ms-*`, `me-*`, `gap-*`, `fw-bold`, `lh-1`, …)
and a pixel spacing scale, scoped to the chrome's own elements so the views are
untouched; the chrome stylesheets are written in px rather than rem for the same
reason.

## The dark palette

Odoo 14 **Community has no dark colour scheme at all**: no `color_scheme()`
hook, no dark bundle. So the module ships both:

- `models/ir_http.py` adds `color_scheme()`, which resolves the scheme from the
  `color_scheme` cookie, then the `saturn_color_scheme` field on the user, then
  dark. The cookie is what the switch writes for the current browser; the
  stored field is what carries the choice to a new browser or past a cookie
  reset. `session_info()` reports the resolved value so the client never
  re-derives it and cannot disagree with the stylesheets that were served;
- `views/assets.xml` defines two dark bundles,
  `saturn_backend.assets_common_dark` and `saturn_backend.assets_backend_dark`.
  They are primary copies of `web.assets_common` and `web.assets_backend`, so
  anything another module adds to the stock bundles lands in them too, and
  `web.webclient_bootstrap` loads their **stylesheets** instead of the stock
  ones when the scheme is dark (the JavaScript always comes from the stock
  bundles);
- in Odoo 14 most of `primary_variables.scss` is declared *without*
  `!default`, so a palette has to come **after** it to win.
  `light_variables.scss` is appended to `web._assets_primary_variables`, and
  the dark bundles load `dark_variables.scss` right after that — later still,
  so its plain assignments replace the light ones there. Everything declared
  afterwards (`secondary_variables.scss`, Odoo's Bootstrap overrides,
  Bootstrap's own variables) is `!default` and derives from these values. The
  dark file inverts Bootstrap's gray ramp, makes `$white` the raised surface
  colour and `$black` white, and pins `$yiq-text-dark`/`$yiq-text-light` so
  Bootstrap 4's contrast picker still chooses readable text;
- Odoo 14 hardcodes a fair share of its surfaces as `white` or a literal gray
  instead of deriving them (form sheets and their paper texture, list headers,
  kanban cards, the search box and panel, popovers, the settings tabs, Discuss
  and the chatter). `dark_views.scss`, appended to the dark backend bundle only,
  corrects those.

These regrade the **views** — lists, forms, sheets, dropdowns, modals — to the
brand grays. Because SCSS resolves at compile time each bundle is fixed, unlike
the `--saturn-*` chrome tokens, which are CSS custom properties.

The chrome follows the same switch. Its colours are **CSS custom properties**,
not SCSS literals:

- `variables.scss` declares the tokens with the **light** values;
- `dark_chrome.scss` is appended to the dark backend bundle and overrides them;
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

Changing `views/assets.xml` or the manifest's `qweb` list later requires a
module upgrade (`-u saturn_backend`).

Branding is per company, under *Settings → Companies*: `Sidebar logo`,
`Sidebar logo (compact)` and `App drawer background`. When the background is
empty the drawer falls back to a flat field; when a logo is empty the Saturn
Theme wordmark is used.

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

Odoo has no side navigation, so some screens decide how many panels to show from
the **viewport** width rather than from the room actually left over. On Odoo 14
the clear case is **Settings**: `.o_setting_box` goes two-up at the `lg`
breakpoint regardless, so on a ~1000px window with the sidebar dragged wide the
two columns come out ~190px each. `.o_settings_container` becomes a container
query root and drops to one column below 700px of container width, so nothing
about the sidebar width is hardcoded.

## State

Odoo 14 has no `res.users.settings`, so the per-user preferences are fields on
the user record and follow the user across browsers: `saturn_color_scheme`,
`saturn_nav_mode`, `saturn_sidenav_collapsed`, `saturn_sidenav_width`,
`saturn_pins`, `saturn_bookmarks`. They reach the browser with
`session_info()`, and are written back through `res.users.saturn_set_setting`,
which accepts only these keys and normalises each value — users cannot write
their own record beyond Odoo's short whitelist, and widening that whitelist
would expose the fields to every other caller of `write`. Recently opened records are
kept in `localStorage`, under a key scoped by database and user id — a browser
profile is often shared, and one origin can serve several databases.

## Differences from the later versions

- No command palette exists in Odoo 14; its buttons open the drawer's search.
- The drawer is not used as a home screen: with no action in the URL, Odoo 14
  opens the user's home action or the first app, as it does without the module.
- The Discuss layout rules of the later versions (channel and member lists) have
  no equivalent here: Odoo 14's Discuss has no member list.

## Notes

- The icon font (Remix Icon, Apache-2.0) is vendored under
  `static/lib/remixicon/`; the backend makes no external requests.
- `corner-shape: squircle` is used for the app tiles and nav icons. Browsers
  without it simply render rounded corners.
