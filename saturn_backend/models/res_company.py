from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    saturn_logo = fields.Image(
        string="Sidebar logo",
        help="Wide logo shown at the top of the expanded side navigation. "
             "Falls back to the brand wordmark, then the company logo.",
    )
    saturn_logo_mini = fields.Image(
        string="Sidebar logo (compact)",
        help="Square logo shown when the side navigation is collapsed to icons. "
             "Falls back to the brand logomark, then the company logo.",
    )
    saturn_background = fields.Image(
        string="App drawer background",
        help="Background image of the full screen app drawer. A generated "
             "gradient is used when empty.",
    )
