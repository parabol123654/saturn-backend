{
    "name": "Saturn Backend (Community)",
    "summary": "Dark backend UI for Odoo 14: app drawer, sidebar navigation, pinned apps",
    "description": """
Saturn Backend
==============

The Saturn backend experience for Odoo 14:

* a resizable left side navigation that switches between *Apps* and *Menu* mode;
* a full screen app drawer ("island") with pinned apps, all features and a
  bookmark workspace;
* recent-record chips, a compact icon-only sidebar mode and a colour scheme
  switch;
* a dark chrome and a dark palette for the views — Odoo 14 Community has no
  dark colour scheme of its own, so the module ships both bundles.
""",
    "version": "14.0.1.0.0",
    "category": "Themes/Backend",
    "author": "Manh Nguyen",
    "license": "LGPL-3",
    "website": "https://github.com/parabol123654/saturn-backend",
    "support": "parabol123654@gmail.com",
    "images": ["static/description/banner.png"],
    "depends": ["web", "mail"],
    "data": [
        # Bundles are QWeb templates in Odoo 14, not a manifest key.
        "views/assets.xml",
        "views/res_company_views.xml",
    ],
    "qweb": [
        "static/src/xml/sidenav.xml",
        "static/src/xml/island.xml",
        "static/src/xml/chrome.xml",
    ],
    "installable": True,
    "application": False,
}
