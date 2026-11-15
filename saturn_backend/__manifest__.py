{
    "name": "Saturn Backend (Community)",
    "summary": "Dark backend UI for Odoo 16: app drawer, sidebar navigation, pinned apps",
    "description": """
Saturn Backend
==============

The Saturn backend experience for Odoo 16:

* a resizable left side navigation that switches between *Apps* and *Menu* mode;
* a full screen app drawer ("island") with pinned apps, all features and a
  bookmark workspace;
* recent-record chips, a compact icon-only sidebar mode and a colour scheme
  switch;
* a grayscale chrome set in Be Vietnam Pro, with working light and dark
  colour schemes (Community ships no usable dark scheme of its own).
""",
    "version": "16.0.1.0.0",
    "category": "Themes/Backend",
    "author": "Manh Nguyen",
    "license": "AGPL-3",
    "website": "https://github.com/parabol123654/saturn-backend",
    "support": "parabol123654@gmail.com",
    "images": ["static/description/banner.png"],
    "depends": ["web", "mail"],
    "data": [
        "views/res_company_views.xml",
        "views/webclient_templates.xml",
    ],
    "assets": {
        # Prepended, so it lands before Odoo's own `primary_variables.scss` and
        # its `!default` values never fire. This is what regrades the views
        # themselves rather than painting over them.
        "web._assets_primary_variables": [
            ("prepend", "saturn_backend/static/src/scss/light_variables.scss"),
        ],
        # Odoo 16 still splits the stylesheets over two bundles, and each one
        # compiles its own copy of the variables, so both dark bundles get the
        # palette. Prepended, so it lands before Odoo's own `!default`
        # variable declarations and actually overrides them.
        "web.dark_mode_assets_common": [
            ("prepend", "saturn_backend/static/src/scss/dark_variables.scss"),
        ],
        "web.dark_mode_assets_backend": [
            ("prepend", "saturn_backend/static/src/scss/dark_variables.scss"),
            # Appended: overrides the chrome tokens declared in variables.scss.
            "saturn_backend/static/src/scss/dark_chrome.scss",
        ],
        "web.assets_backend": [
            # Icon font used throughout the chrome, vendored so the backend
            # makes no external requests (Remix Icon, Apache-2.0).
            "saturn_backend/static/lib/remixicon/remixicon.css",
            "saturn_backend/static/src/scss/variables.scss",
            "saturn_backend/static/src/scss/webclient.scss",
            "saturn_backend/static/src/scss/sidenav.scss",
            "saturn_backend/static/src/scss/subnav.scss",
            "saturn_backend/static/src/scss/island.scss",
            "saturn_backend/static/src/scss/navbar.scss",
            # Last of the stylesheets: the brand type and surface rules have
            # to win the ties against the chrome sheets above.
            "saturn_backend/static/src/scss/brand_saturn.scss",
            "saturn_backend/static/src/core/saturn_service.js",
            "saturn_backend/static/src/core/section_icons.js",
            "saturn_backend/static/src/core/resizable_panel.js",
            "saturn_backend/static/src/core/resizable_panel.xml",
            "saturn_backend/static/src/webclient/sidenav/menu_tree.js",
            "saturn_backend/static/src/webclient/sidenav/subnav.js",
            "saturn_backend/static/src/webclient/sidenav/subnav.xml",
            "saturn_backend/static/src/webclient/sidenav/sidenav.js",
            "saturn_backend/static/src/webclient/sidenav/sidenav.xml",
            "saturn_backend/static/src/webclient/island/island.js",
            "saturn_backend/static/src/webclient/island/island.xml",
            "saturn_backend/static/src/webclient/navbar/navbar.js",
            "saturn_backend/static/src/webclient/navbar/navbar.xml",
            "saturn_backend/static/src/webclient/systray/scheme_switch.js",
            "saturn_backend/static/src/webclient/systray/scheme_switch.xml",
            "saturn_backend/static/src/search/bookmark_button.js",
            "saturn_backend/static/src/search/bookmark_button.xml",
        ],
    },
    "installable": True,
    "application": False,
}
