/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
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
        return this.saturn.iconClass(app);
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
        // Hash routes carry volatile keys (cids, view_type...), so compare
        // the action instead of the URL.
        return this.saturn.isCurrentMenu(entry);
    }

    onEntryClick(entry, ev) {
        ev.preventDefault();
        this.menuService.selectMenu(entry);
        this.props.close?.();
    }
}
