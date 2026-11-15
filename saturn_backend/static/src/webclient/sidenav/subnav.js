/** @odoo-module **/

import { MenuTree } from "@saturn_backend/webclient/sidenav/menu_tree";

/**
 * Menu flyout shown when hovering an app in the sidebar. Its sections wrap into
 * as many columns as they need, which is why the wrapper is a wrapping column
 * flexbox rather than a grid.
 */
export class SaturnSubnav extends MenuTree {
    get sections() {
        return this.saturn.sectionsOf(this.props.app);
    }

    get wrapperStyle() {
        const max = this.props.maxHeight;
        return max ? `max-height: min(719px, ${max}px)` : "";
    }

    onMouseEnter() {
        if (this.props.onMouseEnter) {
            this.props.onMouseEnter();
        }
    }

    onMouseLeave() {
        if (this.props.onMouseLeave) {
            this.props.onMouseLeave();
        }
    }

    afterEntryClick() {
        if (this.props.close) {
            this.props.close();
        }
    }
}
SaturnSubnav.template = "saturn_backend.Subnav";
SaturnSubnav.props = {
    app: Object,
    close: { type: Function, optional: true },
    onMouseEnter: { type: Function, optional: true },
    onMouseLeave: { type: Function, optional: true },
    maxHeight: { type: Number, optional: true },
};
