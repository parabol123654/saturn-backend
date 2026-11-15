from odoo import api, fields, models

SETTINGS_FIELDS = (
    "color_scheme",
    "saturn_nav_mode",
    "saturn_sidenav_collapsed",
    "saturn_sidenav_width",
    "saturn_pins",
    "saturn_bookmarks",
)


class ResUsersSettings(models.Model):
    """Per-user chrome preferences.

    In Odoo 16 ``res.users.settings`` belongs to ``mail`` and only Discuss
    reads it client side, so the values are sent with ``session_info`` (see
    ``ir_http.py``) and written back through :meth:`saturn_set`, which is what
    the sidebar and the app drawer use to remember their state.
    """

    _inherit = "res.users.settings"

    color_scheme = fields.Selection(
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

    @api.model
    def saturn_set(self, key, value):
        """Store one chrome preference for the current user.

        ``set_res_users_settings`` is not reused on purpose: it broadcasts the
        change on the bus as a Discuss record update, and Discuss' client model
        rejects fields it does not declare.
        """
        if key not in SETTINGS_FIELDS:
            return False
        settings = self._find_or_create_for_user(self.env.user)
        settings.write({key: value})
        return True
