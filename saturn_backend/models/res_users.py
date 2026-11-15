import json

from odoo import api, fields, models
from odoo.exceptions import AccessError

# What the browser is allowed to store, and how each value is cleaned. Odoo 14
# has no ``res.users.settings`` model, so the preferences live on the user
# record itself and are written through ``saturn_set_setting`` below.
SATURN_SETTINGS = (
    "saturn_color_scheme",
    "saturn_nav_mode",
    "saturn_sidenav_collapsed",
    "saturn_sidenav_width",
    "saturn_pins",
    "saturn_bookmarks",
)


class ResUsers(models.Model):
    """Per-user chrome preferences.

    They are pushed to the browser with the session (``session.saturn.settings``
    client side) and written back with ``saturn_set_setting``, which is what
    the sidebar and the app drawer use to remember their state.
    """

    _inherit = "res.users"

    saturn_color_scheme = fields.Selection(
        [("light", "Light"), ("dark", "Dark")],
        string="Colour scheme",
        help="Backend colour scheme. The browser cookie takes precedence; this "
             "is what carries the choice to another browser.",
    )
    saturn_nav_mode = fields.Selection(
        [("apps", "Apps"), ("menu", "Menu")],
        string="Side navigation mode",
        default="apps",
    )
    saturn_sidenav_collapsed = fields.Boolean(string="Side navigation collapsed")
    saturn_sidenav_width = fields.Integer(string="Side navigation width", default=243)
    saturn_pins = fields.Char(
        string="Pinned apps",
        help="JSON list of pinned app menu ids.",
        default="[]",
    )
    saturn_bookmarks = fields.Text(
        string="Workspace bookmarks",
        help="JSON list of bookmarked views shown in the drawer workspace tab.",
        default="[]",
    )

    def _saturn_settings(self):
        """Stored chrome preferences of this user, as sent with the session."""
        self.ensure_one()
        user = self.sudo()
        return {name: user[name] for name in SATURN_SETTINGS}

    @api.model
    def saturn_set_setting(self, key, value):
        """Store one chrome preference for the current user.

        A dedicated method instead of a plain ``write``: users may not write on
        their own record beyond a short whitelist, and extending that whitelist
        would also expose the fields to every other caller of ``write``. Only
        the keys above are accepted, and each value is normalised first.
        """
        if key not in SATURN_SETTINGS:
            raise AccessError("Unknown setting: %s" % key)
        if not self.env.user.has_group("base.group_user"):
            raise AccessError("Only internal users have a backend to configure.")
        if key == "saturn_color_scheme":
            value = value if value in ("light", "dark") else False
        elif key == "saturn_nav_mode":
            value = "menu" if value == "menu" else "apps"
        elif key == "saturn_sidenav_collapsed":
            value = bool(value)
        elif key == "saturn_sidenav_width":
            value = max(0, min(int(value or 0), 4000))
        else:
            # JSON lists; anything else is stored as an empty list.
            try:
                parsed = json.loads(value) if isinstance(value, str) else value
            except ValueError:
                parsed = []
            value = json.dumps(parsed if isinstance(parsed, list) else [])
        self.env.user.sudo().write({key: value})
        return True
