odoo.define("saturn_backend.bookmark_button", function (require) {
    "use strict";

    const ControlPanel = require("web.ControlPanel");
    const saturn = require("saturn_backend.saturn");

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

    ControlPanel.patch("saturn_backend.bookmark_button", (T) =>
        class extends T {
            mounted() {
                super.mounted(...arguments);
                // The URL of a view is pushed after its control panel has
                // rendered, and the star depends on it: re-render on every
                // change of the shared state.
                saturn.bus.on("update", this, this.render);
            }

            willUnmount() {
                saturn.bus.off("update", this);
                super.willUnmount(...arguments);
            }

            get saturnIsBookmarked() {
                return saturn.isBookmarked(saturn.currentHref());
            }

            /** Add or remove the displayed view from the drawer workspace. */
            toggleSaturnBookmark() {
                const href = saturn.currentHref();
                if (saturn.isBookmarked(href)) {
                    saturn.removeBookmark(href);
                    return;
                }
                const viewType = this.props.view && this.props.view.type;
                const category = CATEGORIES[viewType] || "cmd";
                saturn.addBookmark({
                    href,
                    name: this.props.title || document.title,
                    category,
                    icon: ICONS[category],
                });
            }
        }
    );
});
