/** @odoo-module **/

import { useState } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { useService } from "@web/core/utils/hooks";

const CATEGORIES = {
    list: "dir",
    kanban: "dir",
    form: "doc",
    pivot: "rpg",
    graph: "rpg",
    cohort: "rpg",
    calendar: "pln",
    gantt: "pln",
    activity: "pln",
    map: "pln",
};

const ICONS = {
    dir: "ri-table-line",
    doc: "ri-file-text-line",
    rpg: "ri-bar-chart-2-line",
    pln: "ri-calendar-line",
    cmd: "ri-layout-grid-line",
};

patch(ControlPanel.prototype, "saturn_backend.ControlPanel", {
    setup() {
        this._super(...arguments);
        this.saturn = useService("saturn");
        // Subscribing to the shared state keeps the star in sync.
        this.saturnState = useState(this.saturn.state);
    },

    get saturnHref() {
        return this.saturn.currentHref();
    },

    get saturnIsBookmarked() {
        const href = this.saturnHref;
        // Reading the list here is what subscribes the button to it.
        return this.saturnState.bookmarks.length >= 0 && this.saturn.isBookmarked(href);
    },

    /** Add or remove the displayed view from the drawer workspace. */
    toggleSaturnBookmark() {
        const href = this.saturnHref;
        if (this.saturn.isBookmarked(href)) {
            this.saturn.removeBookmark(href);
            return;
        }
        const viewType = this.env.config?.viewType;
        const category = CATEGORIES[viewType] || "cmd";
        const action = this.env.config?.getDisplayName?.() || document.title;
        this.saturn.addBookmark({
            href,
            name: action,
            category,
            icon: ICONS[category],
        });
    },
});
