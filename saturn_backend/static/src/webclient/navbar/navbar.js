/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { NavBar } from "@web/webclient/navbar/navbar";
import { useSaturn } from "@saturn_backend/core/saturn_service";

patch(NavBar.prototype, "saturn_backend.NavBar", {
    setup() {
        this._super(...arguments);
        this.saturn = useSaturn();
    },

    /** The apps dropdown is replaced by the full screen drawer. */
    onSaturnToggle() {
        this.saturn.toggleIsland("pick");
    },
});
