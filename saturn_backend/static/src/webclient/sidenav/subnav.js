import { t, useProps } from "@odoo/owl";
import { MenuTree } from "@saturn_backend/webclient/sidenav/menu_tree";

/**
 * Menu flyout shown when hovering an app in the sidebar. Its sections wrap into
 * as many columns as they need, which is why the wrapper is a wrapping column
 * flexbox rather than a grid.
 */
export class SaturnSubnav extends MenuTree {
    static template = "saturn_backend.Subnav";

    props = useProps({
        app: t.object(),
        close: t.function().optional(),
        onMouseEnter: t.function().optional(),
        onMouseLeave: t.function().optional(),
    });

    setup() {
        super.setup();
        this.state = this.saturn.state;
    }

    get sections() {
        return this.saturn.sectionsOf(this.props.app);
    }
}
