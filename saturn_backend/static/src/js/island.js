odoo.define("saturn_backend.Island", function (require) {
    "use strict";

    const saturn = require("saturn_backend.saturn");

    const { Component } = owl;
    const { useRef } = owl.hooks;

    /**
     * Full screen app drawer. It replaces the standard apps dropdown; on a
     * screen with no action behind it, it is what the user stays on.
     */
    class SaturnIsland extends Component {
        constructor() {
            super(...arguments);
            this.saturn = saturn;
            this.state = saturn.state;
            this.searchRef = useRef("search");
            this._wasOpen = false;
            // Capture phase: the action hidden behind the drawer is still
            // mounted and its widgets handle Escape themselves, some of them
            // stopping the event. A dialog sits above the drawer and keeps
            // its Escape.
            this._onKeydown = (ev) => {
                if (
                    this.state.islandOpen &&
                    ev.key === "Escape" &&
                    !document.querySelector(".modal.show, body > .modal")
                ) {
                    saturn.closeIsland();
                }
            };
        }

        mounted() {
            saturn.bus.on("update", this, this.render);
            window.addEventListener("keydown", this._onKeydown, true);
            this._sync();
        }

        patched() {
            this._sync();
        }

        willUnmount() {
            saturn.bus.off("update", this);
            window.removeEventListener("keydown", this._onKeydown, true);
            document.body.classList.remove("saturn-island-open");
        }

        _sync() {
            const open = this.state.islandOpen;
            document.body.classList.toggle("saturn-island-open", open);
            // The search box only exists while the drawer is open: focus it on
            // the render that brought it into the DOM.
            if (open && !this._wasOpen && this.searchRef.el) {
                this.searchRef.el.focus();
            }
            this._wasOpen = open;
        }

        get scheme() {
            return saturn.scheme;
        }

        get backgroundStyle() {
            const url = saturn.backgroundUrl;
            if (!url) {
                return "";
            }
            return `background-image: url('${url}'); background-size: cover; background-repeat: no-repeat; background-position: center;`;
        }

        /** Apps shown in the "All Features" pane, narrowed by the search box. */
        get apps() {
            const apps = saturn.apps;
            const query = this.state.search.trim().toLowerCase();
            if (!query) {
                return apps;
            }
            return apps.filter((app) => app.name.toLowerCase().includes(query));
        }

        get showPinned() {
            return this.state.islandTab === "pick" && this.state.appsPane === "pinned";
        }

        get showAll() {
            return this.state.islandTab === "pick" && this.state.appsPane !== "pinned";
        }

        get pinnedApps() {
            return saturn.pinnedApps;
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
            return saturn.entries
                .filter((entry) => entry.name && entry.name.toLowerCase().includes(query))
                .slice(0, 12);
        }

        get bookmarkGroups() {
            return saturn.bookmarkGroups;
        }

        // ---------------------------------------------------------------------
        // Handlers
        // ---------------------------------------------------------------------
        setTab(tab) {
            saturn.update({ islandTab: tab });
        }

        setPane(pane) {
            saturn.update({ appsPane: pane });
        }

        onAppClick(app, ev) {
            ev.preventDefault();
            saturn.closeIsland();
            saturn.selectMenu(app);
        }

        onEntryClick(entry, ev) {
            ev.preventDefault();
            saturn.closeIsland();
            saturn.selectMenu(entry);
        }

        onPinClick(app, ev) {
            ev.preventDefault();
            ev.stopPropagation();
            saturn.togglePin(app.id);
        }

        /** Apps can be dropped into the workspace straight from the drawer. */
        onBookmarkClick(app, ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (saturn.isBookmarked(app.href)) {
                saturn.removeBookmark(app.href);
                return;
            }
            saturn.addBookmark({
                href: app.href,
                name: app.name,
                category: "cmd",
                icon: "ri-apps-2-line",
                // The icon itself is resolved from the menu at render time: the
                // base64 payload would bloat the stored setting.
                appId: app.id,
            });
        }

        isAppBookmarked(app) {
            return this.state.bookmarks.some((bookmark) => bookmark.href === app.href);
        }

        /** Image for a workspace row that came from an app tile, if still known. */
        bookmarkImage(bookmark) {
            if (!bookmark.appId) {
                return null;
            }
            const menu = saturn.getMenu(bookmark.appId);
            return (menu && menu.webIconData) || null;
        }

        onBookmarkOpen() {
            // A bookmark of the view already displayed changes nothing in the
            // URL, so no navigation would dismiss the drawer.
            saturn.closeIsland();
        }

        onBookmarkRemove(bookmark, ev) {
            ev.preventDefault();
            ev.stopPropagation();
            saturn.removeBookmark(bookmark.href);
        }

        onSearchInput(ev) {
            const search = ev.target.value;
            saturn.update(search ? { search, appsPane: "all" } : { search });
        }

        onSearchKeydown(ev) {
            // Without the emptiness check, Enter on the freshly focused (and
            // still empty) search box would open whichever app happens to be
            // first.
            if (ev.key !== "Enter" || !this.state.search.trim()) {
                return;
            }
            const first = this.apps[0] || this.menuResults[0];
            if (first) {
                saturn.closeIsland();
                saturn.selectMenu(first);
            }
        }
    }
    SaturnIsland.template = "saturn_backend.Island";

    return SaturnIsland;
});
