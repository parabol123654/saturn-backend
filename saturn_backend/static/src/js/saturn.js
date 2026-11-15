odoo.define("saturn_backend.saturn", function (require) {
    "use strict";

    const core = require("web.core");
    const session = require("web.session");
    const utils = require("web.utils");
    const config = require("web.config");

    const _t = core._t;

    const MAX_RECENTS = 14;
    const DEFAULT_WIDTH = 243;
    const MIN_WIDTH = 186;

    const info = session.saturn || {};
    const settings = info.settings || {};

    // Scoped per database and user: one origin can serve several databases, and
    // a browser profile is often shared, so a single key would show one user
    // the record names of another.
    const RECENTS_KEY = `saturn.recents.${session.db || "db"}.${session.uid || "anon"}`;

    /** Parse a stored JSON list, tolerating anything that is not one. */
    function safeJSONArray(value) {
        if (!value) {
            return [];
        }
        if (Array.isArray(value)) {
            return value;
        }
        if (typeof value !== "string") {
            return [];
        }
        try {
            const parsed = JSON.parse(value);
            // The shape matters as much as the parse: a scalar here would make
            // every `.includes()` on it throw from inside a template.
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function clampWidth(width) {
        const value = Math.round(Number(width));
        if (!Number.isFinite(value) || value <= 0) {
            return DEFAULT_WIDTH;
        }
        return Math.max(MIN_WIDTH, value);
    }

    function storedRecents() {
        try {
            return safeJSONArray(window.localStorage.getItem(RECENTS_KEY));
        } catch (e) {
            return [];
        }
    }

    function isSmall() {
        return config.device.size_class <= config.device.SIZES.SM;
    }

    /**
     * Holds every piece of chrome state that the side navigation, the navbar
     * and the app drawer share, and mirrors the persistent part of it onto the
     * user record.
     *
     * Odoo 14 has neither services nor a reactive store the legacy web client
     * and Owl components could share, so this is a plain module: the state is
     * an ordinary object, every change goes through `update()`, and components
     * re-render on the `update` event of `bus`.
     */
    const bus = new owl.core.EventBus();

    const state = {
        // Side navigation
        navMode: settings.saturn_nav_mode === "menu" ? "menu" : "apps",
        navAppId: null, // app pinned in "menu" mode; null == follow current app
        footMode: "recent", // "recent" | "menu"
        collapsed: !!settings.saturn_sidenav_collapsed,
        // Clamped on the way in too: a stored value below MIN_WIDTH would
        // otherwise survive every reload, since setWidth only runs on drag.
        width: clampWidth(settings.saturn_sidenav_width),
        closedSections: {},
        isSmall: isSmall(),
        // Hover flyout: { appId, top, left } or null
        flyout: null,
        // App drawer
        islandOpen: false,
        islandTab: "pick", // "pick" | "space"
        appsPane: "all", // "pinned" | "all"
        editingPins: false,
        search: "",
        // Persisted collections
        pins: safeJSONArray(settings.saturn_pins),
        bookmarks: safeJSONArray(settings.saturn_bookmarks),
        recents: storedRecents(),
        // What the web client is showing
        currentAppId: null,
        currentActionId: null,
        hasAction: false,
    };

    function update(changes) {
        Object.assign(state, changes || {});
        bus.trigger("update");
    }

    // Keep the cookie in step with the scheme the server resolved, so anything
    // else reading it agrees with the bundle that was served.
    const resolvedScheme = info.color_scheme;
    if (
        (resolvedScheme === "light" || resolvedScheme === "dark") &&
        utils.get_cookie("color_scheme") !== resolvedScheme
    ) {
        utils.set_cookie("color_scheme", resolvedScheme, 365 * 24 * 3600);
    }

    function persist(key, value) {
        // Silently ignore write failures: the chrome must keep working even
        // when the user cannot store settings (readonly db, lost session...).
        return session
            .rpc(
                "/web/dataset/call_kw/res.users/saturn_set_setting",
                { model: "res.users", method: "saturn_set_setting", args: [key, value], kwargs: {} },
                { shadow: true }
            )
            .catch(function (error) {
                if (error && error.event) {
                    error.event.preventDefault();
                }
            });
    }

    let widthTimer = null;
    function persistWidth(width) {
        clearTimeout(widthTimer);
        widthTimer = setTimeout(() => persist("saturn_sidenav_width", width), 600);
    }

    function storeRecents() {
        try {
            window.localStorage.setItem(RECENTS_KEY, JSON.stringify(state.recents));
        } catch (e) {
            // storage full or disabled - recents are a convenience only
        }
    }

    // ---------------------------------------------------------------------
    // Menus
    // ---------------------------------------------------------------------
    // The web client hands over the tree it loaded (`load_menus`); it is
    // indexed once into the shape the components use.
    let webClient = null;
    let apps = [];
    let menus = {};
    let openedOver = null;
    let recentController = null;
    let recentTimer = null;

    function actionOf(node) {
        return node.action ? parseInt(String(node.action).split(",")[1], 10) || false : false;
    }

    function firstAction(node) {
        const own = actionOf(node);
        if (own) {
            return own;
        }
        for (const child of node.children || []) {
            const found = firstAction(child);
            if (found) {
                return found;
            }
        }
        return false;
    }

    function iconData(data) {
        if (!data) {
            return false;
        }
        if (data.startsWith("data:")) {
            return data;
        }
        // SVG payloads start with "<?xml" or "<svg" once decoded.
        const svg = data.startsWith("PD94") || data.startsWith("PHN2");
        return `data:image/${svg ? "svg+xml" : "png"};base64,${data}`;
    }

    function indexMenu(node, appId) {
        const actionID = appId === node.id ? firstAction(node) : actionOf(node);
        const menu = {
            id: node.id,
            name: node.name,
            xmlid: node.xmlid,
            appID: appId,
            actionID,
            webIconData: iconData(node.web_icon_data),
            href: actionID ? `/web#menu_id=${appId}&action=${actionID}` : "#",
            childrenTree: [],
        };
        menus[node.id] = menu;
        menu.childrenTree = (node.children || []).map((child) => indexMenu(child, appId));
        return menu;
    }

    function setMenuData(menuData) {
        menus = {};
        apps = ((menuData && menuData.children) || [])
            .map((node) => indexMenu(node, node.id))
            .filter((app) => app.actionID || app.childrenTree.length);
        update();
    }

    function currentController() {
        return webClient && webClient.action_manager
            ? webClient.action_manager.getCurrentController()
            : null;
    }

    function isHomeUrl() {
        const hash = $.bbq.getState(true);
        return !(hash.action || hash.model || hash.menu_id);
    }

    function trackRecent() {
        const controller = currentController();
        if (!controller) {
            return;
        }
        const manager = webClient.action_manager;
        const action = manager.getCurrentAction();
        let name = "";
        // The first screen of an action is named after the action ("Settings",
        // "Discuss"); a widget's own title there is often a placeholder such
        // as "New". Deeper in the breadcrumbs, the record name is what tells
        // two chips apart.
        if (manager.controllerStack.length > 1) {
            try {
                name = controller.widget && controller.widget.getTitle && controller.widget.getTitle();
            } catch (e) {
                name = "";
            }
        }
        if (!name) {
            name = action && (action.display_name || action.name);
        }
        if (!name || !window.location.hash) {
            return;
        }
        const href = service.currentHref();
        let recents = state.recents;
        // The web client pushes the URL of one screen in several steps (the
        // action first, then the menu, then the record), each a different
        // hash: keep one chip per displayed controller, on its latest URL.
        if (controller === recentController && recents.length) {
            recents = recents.slice(1);
        }
        recentController = controller;
        recents = recents.filter((recent) => recent.href !== href);
        recents.unshift({ name, href });
        state.recents = recents.slice(0, MAX_RECENTS);
        storeRecents();
        update();
    }

    const service = {
        state,
        bus,
        update,
        MIN_WIDTH,
        DEFAULT_WIDTH,

        // ---------------------------------------------------------------
        // Wiring with the legacy web client (see web_client.js)
        // ---------------------------------------------------------------
        attach(client) {
            webClient = client;
        },
        setMenuData,
        /** The action manager displayed another controller. */
        onActionUpdated(action, controller) {
            // Navigating from anywhere else (breadcrumb, browser back) dismisses
            // the drawer. Picking an app closes it explicitly, so the only
            // thing this must not do is swallow a deliberate open that lands
            // while the action underneath is still mounting — comparing
            // controllers keeps a real navigation closing the drawer no matter
            // how soon it happens.
            const changes = {
                hasAction: !!controller,
                currentActionId: action && action.id ? action.id : null,
            };
            if (controller !== openedOver) {
                changes.islandOpen = false;
                changes.search = "";
                openedOver = null;
            }
            update(changes);
        },
        /** The URL now describes the displayed controller. */
        onStatePushed() {
            // A view pushes its URL while it is still being set up, before the
            // action manager has made it the current controller; read both
            // once the switch has settled.
            clearTimeout(recentTimer);
            recentTimer = setTimeout(trackRecent, 80);
        },
        onAppChanged(appId) {
            // Follow the app that is actually open again.
            update({ currentAppId: appId || null, navAppId: null });
        },
        onSizeChanged() {
            update({ isSmall: isSmall() });
        },
        /** URL of what is displayed, as stored in recents and bookmarks. */
        currentHref() {
            return "/web" + window.location.hash;
        },

        // ---------------------------------------------------------------
        // Apps
        // ---------------------------------------------------------------
        get apps() {
            return apps;
        },
        get pinnedApps() {
            return state.pins.map((id) => menus[id]).filter((menu) => menu && apps.includes(menu));
        },
        get currentApp() {
            return state.currentAppId ? menus[state.currentAppId] : undefined;
        },
        getMenu(menuId) {
            return menus[menuId];
        },
        /** Every menu that opens an action, apps excluded. */
        get entries() {
            return Object.values(menus).filter((menu) => menu.id !== menu.appID && menu.actionID);
        },
        /** App whose menus are shown in "menu" mode. */
        get navApp() {
            const appId = state.navAppId || state.currentAppId;
            return appId ? menus[appId] : undefined;
        },
        get navSections() {
            return this.sectionsOf(this.navApp);
        },
        /**
         * Top level groups of an app. Menus sitting directly under the app
         * are collected in a leading section named after the app itself.
         */
        sectionsOf(app) {
            if (!app) {
                return [];
            }
            const sections = [];
            let loose = null;
            for (const child of app.childrenTree || []) {
                if (child.childrenTree.length) {
                    sections.push(child);
                } else {
                    loose = loose || { id: `loose-${app.id}`, name: app.name, childrenTree: [] };
                    loose.childrenTree.push(child);
                }
            }
            return loose ? [loose, ...sections] : sections;
        },
        /**
         * Open a menu through the web client, so breadcrumbs, the URL and the
         * current app follow exactly as they do for the stock menu.
         */
        selectMenu(menu) {
            if (!webClient || !menu || !menu.actionID) {
                return Promise.resolve();
            }
            if (menu.id === menu.appID) {
                return webClient.on_app_clicked({
                    data: { action_id: menu.actionID, menu_id: menu.id },
                });
            }
            return Promise.resolve(
                webClient.on_menu_clicked({ data: { id: menu.id, action_id: menu.actionID } })
            ).then(function () {
                // The stock handler assumes the entry belongs to the current
                // app; the flyout and the drawer search can open any of them.
                if (state.currentAppId !== menu.appID) {
                    core.bus.trigger("change_menu_section", menu.appID);
                }
            });
        },
        isPinned(appId) {
            return state.pins.includes(appId);
        },
        /** Keeps every pin star visible so several apps can be pinned in a row. */
        toggleEditPins() {
            update({ editingPins: !state.editingPins });
        },
        togglePin(appId) {
            const pins = state.pins.includes(appId)
                ? state.pins.filter((id) => id !== appId)
                : [...state.pins, appId];
            update({ pins });
            persist("saturn_pins", JSON.stringify(pins));
        },

        // ---------------------------------------------------------------
        // Side navigation
        // ---------------------------------------------------------------
        setNavMode(mode) {
            if (mode === "menu" && !this.navApp) {
                return; // nothing to show yet
            }
            update({ navMode: mode });
            persist("saturn_nav_mode", mode);
        },
        openAppMenu(app) {
            state.navAppId = app.id;
            this.setNavMode("menu");
        },
        backToApps() {
            state.navAppId = null;
            this.setNavMode("apps");
        },
        toggleCollapsed() {
            update({ collapsed: !state.collapsed });
            persist("saturn_sidenav_collapsed", state.collapsed);
        },
        setWidth(width) {
            update({ width: Math.max(MIN_WIDTH, Math.round(width)) });
            persistWidth(state.width);
        },
        toggleSection(sectionId) {
            update({
                closedSections: Object.assign({}, state.closedSections, {
                    [sectionId]: !state.closedSections[sectionId],
                }),
            });
        },
        isSectionOpen(sectionId) {
            return !state.closedSections[sectionId];
        },
        setFootMode(mode) {
            update({ footMode: mode });
        },
        clearRecents() {
            state.recents = [];
            storeRecents();
            update();
        },

        // ---------------------------------------------------------------
        // App drawer
        // ---------------------------------------------------------------
        toggleIsland(tab) {
            if (state.islandOpen && (!tab || tab === state.islandTab)) {
                this.closeIsland();
            } else {
                this.openIsland(tab);
            }
        },
        openIsland(tab, pane) {
            openedOver = currentController();
            update({
                islandTab: tab || "pick",
                // Pins that no longer resolve to a visible app would open the
                // drawer on an empty pane, so ask for the resolved list.
                appsPane: pane || (this.pinnedApps.length ? "pinned" : "all"),
                search: "",
                flyout: null,
                islandOpen: true,
            });
        },
        /**
         * Odoo 14 has no command palette, so the sidebar's search buttons open
         * the drawer on its search box, which filters apps and menus.
         */
        openSearch() {
            this.openIsland("pick", "all");
        },
        closeIsland() {
            if (isHomeUrl() && !currentController()) {
                return; // the drawer is the home screen, keep it visible
            }
            update({ islandOpen: false, search: "" });
        },

        // ---------------------------------------------------------------
        // Workspace bookmarks
        // ---------------------------------------------------------------
        /** Bookmarks grouped by category, in a stable display order. */
        get bookmarkGroups() {
            const order = ["dir", "doc", "pln", "rpg", "cmd"];
            const labels = {
                dir: _t("Directory"),
                doc: _t("Document"),
                pln: _t("Planning"),
                rpg: _t("Reporting"),
                cmd: _t("Actions"),
            };
            const groups = new Map();
            for (const bookmark of state.bookmarks) {
                const key = order.includes(bookmark.category) ? bookmark.category : "cmd";
                if (!groups.has(key)) {
                    groups.set(key, { id: key, name: labels[key], bookmarks: [] });
                }
                groups.get(key).bookmarks.push(bookmark);
            }
            return order.filter((key) => groups.has(key)).map((key) => groups.get(key));
        },
        notify(message, type) {
            if (webClient) {
                webClient.displayNotification({ message, type });
            }
        },
        addBookmark(bookmark) {
            if (state.bookmarks.some((existing) => existing.href === bookmark.href)) {
                this.notify(_t("This view is already bookmarked."), "info");
                return;
            }
            update({ bookmarks: [...state.bookmarks, bookmark] });
            persist("saturn_bookmarks", JSON.stringify(state.bookmarks));
            this.notify(_t("The bookmark has been saved."), "success");
        },
        removeBookmark(href) {
            update({ bookmarks: state.bookmarks.filter((bookmark) => bookmark.href !== href) });
            persist("saturn_bookmarks", JSON.stringify(state.bookmarks));
        },
        isBookmarked(href) {
            return state.bookmarks.some((bookmark) => bookmark.href === href);
        },

        // ---------------------------------------------------------------
        // Colour scheme / branding
        // ---------------------------------------------------------------
        get scheme() {
            // The server resolved this (cookie, then stored setting, then
            // dark) and served the matching bundle, so take its answer
            // instead of re-deriving it — any second guess here can only
            // disagree with the stylesheet that is actually on the page.
            // The cookie is the fallback for a session_info without it.
            const reported = info.color_scheme;
            if (reported === "light" || reported === "dark") {
                return reported;
            }
            return utils.get_cookie("color_scheme") === "light" ? "light" : "dark";
        },
        switchColorScheme() {
            const target = this.scheme === "dark" ? "light" : "dark";
            // Cookie for this browser, setting so the choice survives a
            // cookie reset and follows the user to another one.
            utils.set_cookie("color_scheme", target, 365 * 24 * 3600);
            return persist("saturn_color_scheme", target).then(function () {
                window.location.reload();
            });
        },
        get companyId() {
            return info.company_id || session.company_id || 1;
        },
        /**
         * Bundled brand logo for the current scheme. The wordmark is never
         * recoloured on the fly: both official colourways are shipped, and
         * the scheme picks one.
         */
        brandLogo(mini) {
            const shape = mini ? "mark" : "wordmark";
            const ink = this.scheme === "light" ? "black" : "white";
            return `/saturn_backend/static/src/img/st_${shape}_${ink}.png`;
        },
        /** Sidebar logo: company override first, then the brand wordmark. */
        get logoUrl() {
            if (info.has_logo) {
                return `/web/image/res.company/${this.companyId}/saturn_logo`;
            }
            return this.brandLogo(false);
        },
        get logoMiniUrl() {
            if (info.has_logo_mini) {
                return `/web/image/res.company/${this.companyId}/saturn_logo_mini`;
            }
            return this.brandLogo(true);
        },
        /** Drawer background, or null to fall back on the flat field. */
        get backgroundUrl() {
            return info.has_background
                ? `/web/image/res.company/${this.companyId}/saturn_background`
                : null;
        },
    };

    config.device.bus.on("size_changed", null, () => service.onSizeChanged());

    return service;
});
