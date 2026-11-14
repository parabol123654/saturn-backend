import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { browser } from "@web/core/browser/browser";
import { sectionIcon } from "@saturn_backend/core/section_icons";

/**
 * Shared behaviour for the two places that render an app's menu tree: the
 * sidebar in "Menu" mode and the hover flyout.
 */
export class MenuTree extends Component {
    setup() {
        this.saturn = useService("saturn");
        this.menuService = useService("menu");
    }

    sectionIcon(name) {
        return sectionIcon(name);
    }

    iconClass(app) {
        return app?.webIcon?.iconClass || "ri-apps-2-line";
    }

    /**
     * Flatten a section into the rows it displays: leaves become entries and
     * intermediate menus become a plain header above their own leaves.
     */
    flatten(section) {
        const rows = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.childrenTree?.length) {
                    rows.push({ type: "group", id: `g-${node.id}`, name: node.name });
                    walk(node.childrenTree);
                } else {
                    rows.push({ type: "entry", id: node.id, menu: node });
                }
            }
        };
        walk(section.childrenTree || []);
        return rows;
    }

    isCurrentEntry(entry) {
        const href = entry?.href || "";
        if (!href || href === "#") {
            return false;
        }
        return browser.location.pathname === href.split("?")[0];
    }

    onEntryClick(entry, ev) {
        ev.preventDefault();
        this.menuService.selectMenu(entry);
        // Owl 3 only defines `this.props` through `useProps`, and the sidebar
        // declares none.
        this.props?.close?.();
    }
}
