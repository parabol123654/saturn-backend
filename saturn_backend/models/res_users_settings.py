from odoo import api, fields, models


class ResUsersSettings(models.Model):
    """Per-user chrome preferences.

    Odoo 15 only uses ``res.users.settings`` for Discuss and has no client API
    for it, so the values travel with ``session_info`` (see ``ir_http.py``) and
    are written back through :meth:`saturn_set_settings`, which is what the
    sidebar and the app drawer call to remember their state.
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
    def saturn_set_settings(self, values):
        """Store chrome preferences for the current user.

        Only the fields this module owns can be written, whatever the caller
        sends, and always on the caller's own record.
        """
        allowed = {
            "color_scheme",
            "saturn_nav_mode",
            "saturn_sidenav_collapsed",
            "saturn_sidenav_width",
            "saturn_pins",
            "saturn_bookmarks",
        }
        values = {key: value for key, value in (values or {}).items() if key in allowed}
        if not values or not self.env.user.has_group("base.group_user"):
            return False
        settings = self._find_or_create_for_user(self.env.user)
        settings.sudo().write(values)
        return True
