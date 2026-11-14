from odoo import fields, models


class ResUsersSettings(models.Model):
    """Per-user chrome preferences.

    ``res.users.settings`` records are pushed to the browser with the session
    (``user.settings`` client side) and can be written back with
    ``user.setUserSettings(key, value)``, which is what the sidebar and the app
    drawer use to remember their state.
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
