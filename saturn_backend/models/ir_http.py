from odoo import models
from odoo.http import request

BRANDING_FIELDS = ("saturn_logo", "saturn_logo_mini", "saturn_background")


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    def color_scheme(self):
        """Resolve the colour scheme from the cookie, then the user setting.

        Odoo 14 Community has no colour scheme at all, so this method and the
        dark bundles it selects (see ``views/assets.xml``) are the module's
        own. The cookie wins because it is what the switch writes for the
        current browser; the stored setting is what carries the choice to a new
        browser or after the cookies are cleared. The chrome is designed on the
        dark palette, hence the dark default.
        """
        scheme = request.httprequest.cookies.get("color_scheme")
        if scheme in ("light", "dark"):
            return scheme
        if request.session.uid:
            stored = request.env.user.sudo().saturn_color_scheme
            if stored in ("light", "dark"):
                return stored
        return "dark"

    def _saturn_branding_flags(self, company):
        """Which branding images the company actually has.

        ``/web/image`` answers with a placeholder for empty fields, so the
        client cannot detect a missing logo from the request itself. Reading the
        fields to test them would pull every image through the ORM on each call,
        so ask the attachment table instead — that is where ``fields.Image``
        keeps its payload. If a field is ever declared with
        ``attachment=False`` it simply reads as unset, and the client falls back
        to the standard company logo.
        """
        attachments = request.env["ir.attachment"].sudo().search_read(
            [
                ("res_model", "=", "res.company"),
                ("res_id", "=", company.id),
                ("res_field", "in", list(BRANDING_FIELDS)),
            ],
            ["res_field"],
        )
        return {attachment["res_field"] for attachment in attachments}

    def session_info(self):
        info = super().session_info()
        if not request.session.uid:
            return info
        company = request.env.company
        present = self._saturn_branding_flags(company)
        info["saturn"] = {
            "company_id": company.id,
            # The client must not re-derive this: it decides how the chrome is
            # painted, and it has to agree with the bundle just served.
            "color_scheme": self.color_scheme(),
            "has_logo": "saturn_logo" in present,
            "has_logo_mini": "saturn_logo_mini" in present,
            "has_background": "saturn_background" in present,
            "settings": request.env.user._saturn_settings(),
        }
        return info
