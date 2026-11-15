/** @odoo-module **/

import { useState } from "@odoo/owl";
import { MenuTree } from "@saturn_backend/webclient/sidenav/menu_tree";

/**
 * Menu flyout shown when hovering an app in the sidebar. Its sections wrap into
 * as many columns as they need, which is why the wrapper is a wrapping column
 * flexbox rather than a grid.
 */
export class SaturnSubnav extends MenuTree {
    static template = "saturn_backend.Subnav";

    static props = {
        app: Object,
        close: { type: Function, optional: true },
        onMouseEnter: { type: Function, optional: true },
        onMouseLeave: { type: Function, optional: true },
        maxHeight: { type: Number, optional: true },
    };

    setup() {
        super.setup();
        this.state = useState(this.saturn.state);
    }

    get sections() {
        return this.saturn.sectionsOf(this.props.app);
    }
}
