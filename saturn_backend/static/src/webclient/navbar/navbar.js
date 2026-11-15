/** @odoo-module **/

import { useState } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { NavBar } from "@web/webclient/navbar/navbar";
import { useService } from "@web/core/utils/hooks";

patch(NavBar.prototype, {
    setup() {
        super.setup();
        this.saturn = useService("saturn");
        this.saturnUi = useState(useService("ui"));
    },

    /** The apps dropdown is replaced by the full screen drawer. */
    onSaturnToggle() {
        this.saturn.toggleIsland("pick");
    },
});
