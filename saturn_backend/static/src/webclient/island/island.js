/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useEffect } from "@web/core/utils/hooks";
import { useSaturn } from "@saturn_backend/core/saturn_service";

const { Component } = owl;
const { useExternalListener, useRef } = owl.hooks;

/**
 * Full screen app drawer. It replaces the standard apps dropdown and doubles
 * as the home screen: when /web is opened without an action, the drawer is
 * what the user lands on.
 */
export class SaturnIsland extends Component {
    setup() {
        this.saturn = useSaturn();
        this.state = this.saturn.state;
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
        // on that, rather than on the open flag.
        useEffect(
            (el) => {
                if (el) {
                    el.focus();
                }
            },
            () => [this.searchRef.el]
        );

        // Capture phase: the hotkey service consumes Escape for whatever is
        // registered behind the drawer, and the action hidden there is still
        // mounted. A dialog or the command palette sits above the drawer and
        // keeps its Escape.
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

    get pinnedApps() {
        return this.saturn.pinnedApps;
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
        return this.saturn
            .getAllMenus()
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
    setTab(tab) {
        this.state.islandTab = tab;
    }

    setPane(pane) {
        this.state.appsPane = pane;
    }

    onCloseClick() {
        this.saturn.closeIsland();
    }

    onEditPinsClick() {
        this.saturn.toggleEditPins();
    }

    onAppClick(app, ev) {
        ev.preventDefault();
        this.saturn.closeIsland();
        this.saturn.selectMenu(app);
    }

    onEntryClick(entry, ev) {
        ev.preventDefault();
        this.saturn.closeIsland();
        this.saturn.selectMenu(entry);
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

    onBookmarkRemove(bookmark, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.saturn.removeBookmark(bookmark.href);
    }

    appHref(app) {
        return this.saturn.menuHref(app);
    }

    isAppBookmarked(app) {
        const href = this.appHref(app);
        return this.state.bookmarks.some((bookmark) => bookmark.href === href);
    }

    /** Image for a workspace row that came from an app tile, if still known. */
    bookmarkImage(bookmark) {
        if (!bookmark.appId) {
            return null;
        }
        return this.saturn.iconSrc(this.saturn.getMenu(bookmark.appId));
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
            this.saturn.selectMenu(first);
        }
    }
}
SaturnIsland.template = "saturn_backend.Island";

registry.category("main_components").add("saturn.Island", { Component: SaturnIsland });
