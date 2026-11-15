/** @odoo-module **/

import { browser } from "@web/core/browser/browser";
import { currentHref, useSaturn } from "@saturn_backend/core/saturn_service";

const { Component, QWeb } = owl;

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

/**
 * Bookmark toggle shown next to the breadcrumbs.
 *
 * Odoo 15 has two control panels — the legacy one behind list, kanban and
 * form views, and the new one behind graph and pivot — living in two different
 * environments. The button therefore asks neither for anything: the view is
 * identified by the address bar, and its name comes from the action service.
 */
export class SaturnBookmark extends Component {
    setup() {
        this.saturn = useSaturn();
    }

    get isBookmarked() {
        return this.saturn.isBookmarked(currentHref());
    }

    /** Add or remove the displayed view from the drawer workspace. */
    onClick() {
        const href = currentHref();
        if (this.saturn.isBookmarked(href)) {
            this.saturn.removeBookmark(href);
            return;
        }
        const match = /[#&]view_type=([a-z_]+)/.exec(browser.location.hash);
        const category = CATEGORIES[match && match[1]] || "cmd";
        this.saturn.addBookmark({
            href,
            name: this.saturn.currentTitle,
            category,
            icon: ICONS[category],
        });
    }
}
SaturnBookmark.template = "saturn_backend.Bookmark";

// Registered globally rather than on one class: control panel subclasses copy
// `components` at definition time, and both the legacy and the new control
// panel templates use the tag.
QWeb.registerComponent("SaturnBookmark", SaturnBookmark);
