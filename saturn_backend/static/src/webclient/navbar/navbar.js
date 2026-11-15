/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { NavBar } from "@web/webclient/navbar/navbar";
import { useBus, useService } from "@web/core/utils/hooks";

patch(NavBar.prototype, "saturn_backend.NavBar", {
    setup() {
        this._super(...arguments);
        this.saturn = useService("saturn");
        this.saturnUi = useService("ui");
        useBus(this.saturnUi.bus, "resize", () => this.render());
    },

    /** The apps dropdown is replaced by the full screen drawer. */
    onSaturnToggle() {
        this.saturn.toggleIsland("pick");
    },
});
