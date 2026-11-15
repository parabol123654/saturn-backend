odoo.define("saturn_backend.Sidenav", function (require) {
    "use strict";

    const saturn = require("saturn_backend.saturn");
    const { sectionIcon } = require("saturn_backend.section_icons");

    const { Component } = owl;

    const COLLAPSED_WIDTH = 56;
    const HOVER_OPEN_DELAY = 130;
    const HOVER_CLOSE_DELAY = 220;

    /**
     * Shared behaviour for the two places that render an app's menu tree: the
     * sidebar in "Menu" mode and the hover flyout. Both re-render on every
     * change of the shared state.
     */
    class MenuTree extends Component {
        constructor() {
            super(...arguments);
            this.saturn = saturn;
            this.state = saturn.state;
        }

        mounted() {
            saturn.bus.on("update", this, this.render);
        }

        willUnmount() {
            saturn.bus.off("update", this);
        }

        sectionIcon(name) {
            return sectionIcon(name);
        }

        /**
         * Flatten a section into the rows it displays: leaves become entries
         * and intermediate menus become a plain header above their own leaves.
         */
        flatten(section) {
            const rows = [];
            const walk = (nodes) => {
                for (const node of nodes) {
                    if (node.childrenTree.length) {
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
            return (
                !!entry.actionID &&
                entry.actionID === this.state.currentActionId &&
                entry.appID === this.state.currentAppId
            );
        }

        onEntryClick(entry, ev) {
            ev.preventDefault();
            saturn.update({ flyout: null });
            saturn.selectMenu(entry);
        }
    }

    // -------------------------------------------------------------------------
    // Hover flyout
    // -------------------------------------------------------------------------
    // Odoo 14 has no popover service, so the flyout is its own component on the
    // body, placed next to the hovered row from the coordinates the sidebar
    // publishes in `state.flyout`.
    const timers = { open: null, close: null };

    function scheduleFlyoutClose() {
        clearTimeout(timers.open);
        clearTimeout(timers.close);
        timers.close = setTimeout(() => saturn.update({ flyout: null }), HOVER_CLOSE_DELAY);
    }

    class SaturnSubnav extends MenuTree {
        get app() {
            const flyout = this.state.flyout;
            return flyout ? saturn.getMenu(flyout.appId) : undefined;
        }

        get sections() {
            return saturn.sectionsOf(this.app);
        }

        /**
         * Anchored to the hovered row: hanging down from its top when there is
         * more room below it, standing on its bottom otherwise — so a low row
         * opens upwards instead of off the bottom of the screen.
         */
        get style() {
            const flyout = this.state.flyout;
            if (!flyout) {
                return "";
            }
            const vertical = flyout.up
                ? `bottom: ${window.innerHeight - flyout.bottom}px;`
                : `top: ${flyout.top}px;`;
            return `${vertical} left: ${flyout.left}px;`;
        }

        /**
         * The room left on that side caps the height; the sections are a
         * wrapping column, so what does not fit spills into another column
         * rather than past the screen edge.
         */
        get wrapperStyle() {
            const flyout = this.state.flyout;
            return flyout ? `max-height: min(719px, ${flyout.maxHeight}px);` : "";
        }

        onMouseEnter() {
            clearTimeout(timers.close);
        }

        onMouseLeave() {
            scheduleFlyoutClose();
        }
    }
    SaturnSubnav.template = "saturn_backend.Subnav";

    // -------------------------------------------------------------------------
    // Side navigation
    // -------------------------------------------------------------------------
    class SaturnSidenav extends MenuTree {
        mounted() {
            super.mounted();
            this._publishWidth();
        }

        patched() {
            this._publishWidth();
        }

        willUnmount() {
            super.willUnmount();
            clearTimeout(timers.open);
            clearTimeout(timers.close);
            document.documentElement.style.removeProperty("--uw-sidenav");
            document.body.classList.remove("saturn-nolside");
        }

        /**
         * The panel is fixed, so the web client itself has to reserve the
         * room: the width is published on :root and the shell indents by it.
         */
        _publishWidth() {
            const visible = this.visible;
            const width = this.state.collapsed ? COLLAPSED_WIDTH : this.state.width;
            const value = `${visible ? width : 0}px`;
            const root = document.documentElement;
            if (root.style.getPropertyValue("--uw-sidenav") !== value) {
                root.style.setProperty("--uw-sidenav", value);
                // Views size themselves on this event (pivot, graph, kanban).
                require("web.core").bus.trigger("resize");
            }
            document.body.classList.toggle("saturn-nolside", !visible);
        }

        get visible() {
            return !this.state.isSmall;
        }

        get apps() {
            return saturn.apps;
        }

        get sections() {
            return saturn.navSections;
        }

        get recents() {
            return this.state.recents;
        }

        isCurrentApp(app) {
            return this.state.currentAppId === app.id;
        }

        // ---------------------------------------------------------------------
        // Hover flyout
        // ---------------------------------------------------------------------
        onAppHover(app, ev) {
            const target = ev.currentTarget;
            clearTimeout(timers.close);
            clearTimeout(timers.open);
            if (!saturn.sectionsOf(app).length) {
                saturn.update({ flyout: null });
                return;
            }
            timers.open = setTimeout(() => {
                // The row can be gone by now (breakpoint change, mode switch);
                // anchoring to a detached node would place the panel at 0,0
                // with no way to dismiss it by leaving the sidebar.
                if (!target.isConnected) {
                    return;
                }
                const rect = target.getBoundingClientRect();
                const side = this.el.getBoundingClientRect();
                const below = window.innerHeight - rect.top;
                const above = rect.bottom;
                saturn.update({
                    flyout: {
                        appId: app.id,
                        top: Math.round(rect.top),
                        bottom: Math.round(rect.bottom),
                        up: above > below,
                        maxHeight: Math.max(160, Math.round(Math.max(below, above) - 12)),
                        left: Math.round(side.right + 6),
                    },
                });
            }, HOVER_OPEN_DELAY);
        }

        onSidenavLeave(ev) {
            // Moving onto the flyout itself must not close it.
            const related = ev.relatedTarget;
            if (related && related.closest && related.closest(".sidenav_2nd")) {
                return;
            }
            scheduleFlyoutClose();
        }

        // ---------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------
        onAppClick(app, ev) {
            ev.preventDefault();
            clearTimeout(timers.open);
            saturn.update({ flyout: null });
            saturn.selectMenu(app);
        }

        onAppDrill(app, ev) {
            ev.preventDefault();
            ev.stopPropagation();
            clearTimeout(timers.open);
            saturn.update({ flyout: null });
            saturn.openAppMenu(app);
        }

        /** Drag the right edge to resize; Odoo 14 ships no resizable panel. */
        onResizeStart(ev) {
            if (this.state.collapsed) {
                return;
            }
            ev.preventDefault();
            const left = this.el.getBoundingClientRect().left;
            const onMove = (moveEv) => saturn.setWidth(moveEv.clientX - left);
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                document.body.classList.remove("saturn-resizing");
            };
            document.body.classList.add("saturn-resizing");
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        }

        openSearch() {
            saturn.openSearch();
        }

        openActivityHub() {
            // Re-use the systray activity menu rather than duplicating it. The
            // click that got here is still bubbling, and Bootstrap closes every
            // open dropdown when it reaches the document — so open it after.
            const toggle = document.querySelector(
                ".o_menu_systray .o_mail_systray_item .dropdown-toggle .fa-clock-o"
            );
            if (toggle) {
                setTimeout(() => toggle.closest(".dropdown-toggle").click(), 0);
            }
        }
    }
    SaturnSidenav.template = "saturn_backend.Sidenav";

    return { MenuTree, SaturnSidenav, SaturnSubnav };
});
