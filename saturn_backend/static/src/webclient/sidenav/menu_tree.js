/** @odoo-module **/

import { sectionIcon } from "@saturn_backend/core/section_icons";
import { useSaturn } from "@saturn_backend/core/saturn_service";

const { Component } = owl;

/**
 * Shared behaviour for the two places that render an app's menu tree: the
 * sidebar in "Menu" mode and the hover flyout.
 */
export class MenuTree extends Component {
    setup() {
        this.saturn = useSaturn();
        this.state = this.saturn.state;
    }

    sectionIcon(name) {
        return sectionIcon(name);
    }

    /**
     * Flatten a section into the rows it displays: leaves become entries and
     * intermediate menus become a plain header above their own leaves.
     */
    flatten(section) {
        const rows = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.childrenTree && node.childrenTree.length) {
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

    /** Odoo 15 menus have no address of their own, so match on the action. */
    isCurrentEntry(entry) {
        return !!(entry && entry.actionID && entry.actionID === this.saturn.currentActionId);
    }

    onSectionToggle(section) {
        this.saturn.toggleSection(section.id);
    }

    onEntryClick(entry, ev) {
        ev.preventDefault();
        this.saturn.selectMenu(entry);
        this.afterEntryClick();
    }

    /** Hook for the flyout, which dismisses itself once an entry is picked. */
    afterEntryClick() {}
}
