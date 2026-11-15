/** @odoo-module **/

import { Component, useEffect, useExternalListener, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Full screen app drawer. It replaces the standard apps dropdown and doubles
 * as the home screen: when /web is opened without an action, the drawer is
 * what the user lands on.
 */
export class SaturnIsland extends Component {
    static template = "saturn_backend.Island";
    static props = {};

    setup() {
        this.saturn = useService("saturn");
        this.menuService = useService("menu");
        this.state = useState(this.saturn.state);
        this.searchRef = useRef("search");

        useEffect(
            (open) => {
                document.body.classList.toggle("saturn-island-open", open);
                return () => document.body.classList.remove("saturn-island-open");
            },
            () => [this.state.islandOpen]
        );

        // The search box only exists while the drawer is open, so its ref
        // flips from null to an element exactly when the drawer opens: focus
        // on that, rather than on the open flag, which changes a render before
        // the input is in the DOM.
        useEffect(
            (el) => el?.focus(),
            () => [this.searchRef.el]
        );

        // Capture phase: the hotkey plugin calls `stopImmediatePropagation()`
        // once any registration consumes the key, and the action hidden behind
        // the drawer is still mounted — a list view's search bar registers
        // Escape, so a bubbling listener here never fires over a list. A dialog
        // or the command palette sits above the drawer and keeps its Escape.
        useExternalListener(
            window,
            "keydown",
            (ev) => {
                if (
                    this.state.islandOpen &&
                    ev.key === "Escape" &&
                    !document.querySelector(".modal, .o_command_palette")
                ) {
                    this.saturn.closeIsland();
                }
            },
            { capture: true }
        );
    }

    get scheme() {
        return this.saturn.scheme;
    }

    get backgroundStyle() {
        const url = this.saturn.backgroundUrl;
        if (!url) {
            return "";
        }
        return `background-image: url('${url}'); background-size: cover; background-repeat: no-repeat; background-position: center;`;
    }

    /** Apps shown in the "All Features" pane, narrowed by the search box. */
    get apps() {
        const apps = this.saturn.apps;
        const query = this.state.search.trim().toLowerCase();
        if (!query) {
            return apps;
        }
        return apps.filter((app) => app.name.toLowerCase().includes(query));
    }

    // The getters below read `this.state` during render on purpose: that read
    // is what subscribes the drawer to pins and bookmarks, so a tile button
    // re-renders its icon as soon as the data changes.
    get pinnedApps() {
        const byId = new Map(this.saturn.apps.map((app) => [app.id, app]));
        return this.state.pins.map((id) => byId.get(id)).filter(Boolean);
    }

    isAppPinned(app) {
        return this.state.pins.includes(app.id);
    }

    /** Menu entries matching the search box, shown underneath the apps. */
    get menuResults() {
        const query = this.state.search.trim().toLowerCase();
        if (query.length < 2) {
            return [];
        }
        const appIds = new Set(this.saturn.apps.map((app) => app.id));
        return this.menuService
            .getAll()
            .filter(
                (entry) =>
                    entry.id !== "root" &&
                    !appIds.has(entry.id) &&
                    entry.actionID &&
                    entry.name &&
                    entry.name.toLowerCase().includes(query)
            )
            .slice(0, 12);
    }

    get bookmarkGroups() {
        return this.saturn.groupBookmarks(this.state.bookmarks);
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------
    onAppClick(app, ev) {
        ev.preventDefault();
        this.saturn.closeIsland();
        this.menuService.selectMenu(app);
    }

    onEntryClick(entry, ev) {
        ev.preventDefault();
        this.saturn.closeIsland();
        this.menuService.selectMenu(entry);
    }

    onPinClick(app, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.saturn.togglePin(app.id);
    }

    /** Apps can be dropped into the workspace straight from the drawer. */
    onBookmarkClick(app, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const href = this.appHref(app);
        if (this.saturn.isBookmarked(href)) {
            this.saturn.removeBookmark(href);
            return;
        }
        this.saturn.addBookmark({
            href,
            name: app.name,
            category: "cmd",
            icon: "ri-apps-2-line",
            // The icon itself is resolved from the menu at render time: the
            // base64 payload would bloat the stored setting.
            appId: app.id,
        });
    }

    appHref(app) {
        return this.saturn.menuHref(app);
    }

    isAppBookmarked(app) {
        const href = this.appHref(app);
        // Reading the list here is what subscribes the tile to it.
        return this.state.bookmarks.length >= 0 && this.saturn.isBookmarked(href);
    }

    /** Image for a workspace row that came from an app tile, if still known. */
    bookmarkImage(bookmark) {
        if (!bookmark.appId) {
            return null;
        }
        return this.saturn.iconData(this.menuService.getMenu(bookmark.appId));
    }

    onSearchInput(ev) {
        this.state.search = ev.target.value;
        if (this.state.search) {
            this.state.appsPane = "all";
        }
    }

    onSearchKeydown(ev) {
        // Without the emptiness check, Enter on the freshly focused (and still
        // empty) search box would open whichever app happens to be first.
        if (ev.key !== "Enter" || !this.state.search.trim()) {
            return;
        }
        const first = this.apps[0] || this.menuResults[0];
        if (first) {
            this.saturn.closeIsland();
            this.menuService.selectMenu(first);
        }
    }

    iconClass(app) {
        return this.saturn.iconClass(app);
    }
}

registry.category("main_components").add("saturn.Island", { Component: SaturnIsland });
