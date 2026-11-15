/** @odoo-module **/

import { registry } from "@web/core/registry";
import { reactive } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { cookie } from "@web/core/browser/cookie";
import { browser } from "@web/core/browser/browser";
import { session } from "@web/session";

const MAX_RECENTS = 14;
const DEFAULT_WIDTH = 243;
const MIN_WIDTH = 186;

// Scoped per database and user: one origin can serve several databases, and a
// browser profile is often shared, so a single key would show one user the
// record names of another.
function recentsKey(user) {
    return `saturn.recents.${session.db || "db"}.${user.userId ?? "anon"}`;
}

/** The address of what is displayed: Odoo 17 keeps the whole state in the hash. */
function currentHref() {
    const { pathname, search, hash } = browser.location;
    return pathname + search + hash;
}

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
    } catch {
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

/**
 * Holds every piece of chrome state that the side navigation, the navbar and
 * the app drawer share, and mirrors the persistent part of it onto
 * ``res.users.settings``.
 */
export const saturnService = {
    dependencies: ["menu", "action", "ui", "notification", "user", "router"],
    start(env, { menu, action, notification, user, router }) {
        const settings = user.settings || {};
        const RECENTS_KEY = recentsKey(user);

        // A shared reactive object: components subscribe to it with
        // `useState(saturn.state)` and re-render on the keys they read.
        const state = reactive({
            // Side navigation
            navMode: settings.saturn_nav_mode === "menu" ? "menu" : "apps",
            navAppId: null, // app pinned in "menu" mode; null == follow current app
            footMode: "recent", // "recent" | "menu"
            collapsed: !!settings.saturn_sidenav_collapsed,
            // Clamped on the way in too: a stored value below MIN_WIDTH would
            // otherwise survive every reload, since setWidth only runs on drag.
            width: clampWidth(settings.saturn_sidenav_width),
            closedSections: {},
            // Address of the displayed view, kept in step with the router so
            // that anything derived from it (bookmark star, current menu
            // entry) re-renders when it changes.
            href: currentHref(),
            // App drawer
            islandOpen: false,
            islandTab: "pick", // "pick" | "space"
            appsPane: "all", // "pinned" | "all"
            editingPins: false,
            search: "",
            // Persisted collections
            pins: safeJSONArray(settings.saturn_pins),
            bookmarks: safeJSONArray(settings.saturn_bookmarks),
            recents: safeJSONArray(browser.localStorage.getItem(RECENTS_KEY)),
        });

        // Keep the cookie in step with the scheme the server resolved. Stock
        // code reads the cookie directly (chart palettes, the code editor
        // theme, the spreadsheet dashboard renderer), so on the dark default,
        // where no cookie has been written yet, those widgets would come out
        // light on a dark page.
        const resolvedScheme = session.saturn?.color_scheme;
        if (
            (resolvedScheme === "light" || resolvedScheme === "dark") &&
            cookie.get("color_scheme") !== resolvedScheme
        ) {
            cookie.set("color_scheme", resolvedScheme);
        }

        function persist(key, value) {
            // Silently ignore write failures: the chrome must keep working even
            // when the user cannot store settings (public user, readonly db...).
            Promise.resolve(user.setUserSettings(key, value)).catch(() => {});
        }

        let widthTimer = null;
        function persistWidth(width) {
            browser.clearTimeout(widthTimer);
            widthTimer = browser.setTimeout(() => persist("saturn_sidenav_width", width), 600);
        }

        function storeRecents() {
            try {
                browser.localStorage.setItem(RECENTS_KEY, JSON.stringify(state.recents));
            } catch {
                // storage full or disabled - recents are a convenience only
            }
        }

        function isHomeUrl() {
            const path = browser.location.pathname.replace(/\/+$/, "");
            if (path !== "/web" && path !== "") {
                return false;
            }
            // `/web#action=...` is a view, bare `/web` (or `/web#cids=1`) is home.
            return !/[#&](action|model|menu_id)=/.test(browser.location.hash);
        }

        // The drawer takes over the whole screen, so it doubles as the home
        // screen: landing on /web without an action opens it.
        state.islandOpen = isHomeUrl();

        // Navigating from anywhere else (breadcrumb, browser back, a command)
        // dismisses the drawer. Picking an app closes it explicitly, so the
        // only thing this must not do is swallow a deliberate open that lands
        // while the action underneath is still mounting — that action fires
        // UI-UPDATED for the controller that was already current. Comparing
        // controllers rather than elapsed time keeps a real navigation (Back,
        // a command) closing the drawer no matter how soon it happens.
        let openedOver = null;
        env.bus.addEventListener("ACTION_MANAGER:UI-UPDATED", () => {
            if (action.currentController !== openedOver) {
                state.islandOpen = false;
                state.search = "";
                openedOver = null;
            }
            // The router pushes the new hash on a timer, after this event: the
            // address read right now would still be the previous view's.
            const controller = action.currentController;
            scheduleHrefRefresh(() => trackRecent(controller));
        });

        let hrefTimer = null;
        let afterRefresh = [];
        function scheduleHrefRefresh(callback) {
            if (callback) {
                afterRefresh.push(callback);
            }
            browser.clearTimeout(hrefTimer);
            hrefTimer = browser.setTimeout(() => {
                state.href = currentHref();
                const callbacks = afterRefresh;
                afterRefresh = [];
                callbacks.forEach((cb) => cb());
            });
        }
        // Record paging, view switches and the like push state without any bus
        // event. Both router entry points are debounced with their own timer,
        // so arming ours after each call lands it behind the actual push.
        for (const method of ["pushState", "replaceState"]) {
            const original = router[method];
            router[method] = (...args) => {
                const result = original.apply(router, args);
                scheduleHrefRefresh();
                return result;
            };
        }
        browser.addEventListener("hashchange", () => scheduleHrefRefresh());

        env.bus.addEventListener("MENUS:APP-CHANGED", () => {
            // Follow the app that is actually open again.
            state.navAppId = null;
        });

        function trackRecent(controller) {
            const name = controller?.displayName;
            if (!name || controller !== action.currentController) {
                return;
            }
            const href = currentHref();
            const recents = state.recents.filter((recent) => recent.href !== href);
            recents.unshift({ name, href });
            state.recents = recents.slice(0, MAX_RECENTS);
            storeRecents();
        }

        const service = {
            state,
            MIN_WIDTH,
            DEFAULT_WIDTH,

            // ---------------------------------------------------------------
            // Apps
            // ---------------------------------------------------------------
            get apps() {
                return menu.getApps().filter((app) => app.actionID || app.children?.length);
            },
            get pinnedApps() {
                const byId = new Map(this.apps.map((app) => [app.id, app]));
                return state.pins.map((id) => byId.get(id)).filter(Boolean);
            },
            get currentApp() {
                return menu.getCurrentApp();
            },
            /** Whether there is an action to go back to behind the drawer. */
            get hasAction() {
                return !!action.currentController;
            },
            /** App whose menus are shown in "menu" mode. */
            get navApp() {
                const appId = state.navAppId ?? this.currentApp?.id;
                return appId ? menu.getMenu(appId) : undefined;
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
                const tree = menu.getMenuAsTree(app.id);
                const sections = [];
                let loose = null;
                for (const child of tree.childrenTree || []) {
                    if (child.childrenTree?.length) {
                        sections.push(child);
                    } else {
                        // Leaves directly under the app get their own leading
                        // section, titled with the app name.
                        loose = loose || { id: `loose-${app.id}`, name: app.name, childrenTree: [] };
                        loose.childrenTree.push(child);
                    }
                }
                return loose ? [loose, ...sections] : sections;
            },
            /**
             * Image of an app. Odoo 17 ships the icon as bare base64 (or, when
             * the file is missing, only as the `module,path` it was declared
             * with), not as something an `<img>` can load.
             */
            iconSrc(entry) {
                const data = entry?.webIconData;
                if (data) {
                    if (data.startsWith("data:") || data.startsWith("/")) {
                        return data;
                    }
                    const mimetype = entry.webIconDataMimetype || "image/png";
                    return `data:${mimetype};base64,${data.replace(/\s/g, "")}`;
                }
                const parts = typeof entry?.webIcon === "string" ? entry.webIcon.split(",") : [];
                return parts.length === 2 ? `/${parts[0]}/${parts[1]}` : null;
            },
            /** Icon font class of an app declared as `class,color,background`. */
            iconClass(entry) {
                const parts = typeof entry?.webIcon === "string" ? entry.webIcon.split(",") : [];
                return (parts.length === 3 && parts[0]) || "ri-apps-2-line";
            },
            /** Link to a menu, in the form the stock navbar uses. */
            menuHref(entry) {
                if (!entry || typeof entry.id !== "number") {
                    return "#";
                }
                const parts = [`menu_id=${entry.id}`];
                if (entry.actionID) {
                    parts.push(`action=${entry.actionID}`);
                }
                return "#" + parts.join("&");
            },
            /** Address of the displayed view, as stored in recents and bookmarks. */
            currentHref,
            /** Whether a menu entry points at the action currently displayed. */
            isCurrentMenu(entry) {
                const current = action.currentController?.action?.id;
                return !!entry?.actionID && entry.actionID === current;
            },
            isPinned(appId) {
                return state.pins.includes(appId);
            },
            /** Keeps every pin star visible so several apps can be pinned in a row. */
            toggleEditPins() {
                state.editingPins = !state.editingPins;
            },
            togglePin(appId) {
                const pins = state.pins.includes(appId)
                    ? state.pins.filter((id) => id !== appId)
                    : [...state.pins, appId];
                state.pins = pins;
                persist("saturn_pins", JSON.stringify(pins));
            },

            // ---------------------------------------------------------------
            // Side navigation
            // ---------------------------------------------------------------
            setNavMode(mode) {
                if (mode === "menu" && !this.navApp) {
                    return; // nothing to show yet
                }
                state.navMode = mode;
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
                state.collapsed = !state.collapsed;
                persist("saturn_sidenav_collapsed", state.collapsed);
            },
            setWidth(width) {
                state.width = Math.max(MIN_WIDTH, Math.round(width));
                persistWidth(state.width);
            },
            toggleSection(sectionId) {
                state.closedSections = {
                    ...state.closedSections,
                    [sectionId]: !state.closedSections[sectionId],
                };
            },
            isSectionOpen(sectionId) {
                return !state.closedSections[sectionId];
            },
            setFootMode(mode) {
                state.footMode = mode;
            },
            clearRecents() {
                state.recents = [];
                storeRecents();
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
            openIsland(tab) {
                openedOver = action.currentController;
                state.islandTab = tab || "pick";
                // Pins that no longer resolve to a visible app would open the
                // drawer on an empty pane, so ask for the resolved list.
                state.appsPane = this.pinnedApps.length ? "pinned" : "all";
                state.search = "";
                state.islandOpen = true;
            },
            closeIsland() {
                if (isHomeUrl() && !action.currentController) {
                    return; // the drawer is the home screen, keep it visible
                }
                state.islandOpen = false;
                state.search = "";
            },

            // ---------------------------------------------------------------
            // Workspace bookmarks
            // ---------------------------------------------------------------
            get bookmarks() {
                return state.bookmarks;
            },
            /** Bookmarks grouped by category, in a stable display order. */
            get bookmarkGroups() {
                return this.groupBookmarks(state.bookmarks);
            },
            /**
             * Grouping as a pure function of the list, so a component can pass
             * the list it read during render and so stay subscribed to it.
             */
            groupBookmarks(bookmarks) {
                const order = ["dir", "doc", "pln", "rpg", "cmd"];
                const labels = {
                    dir: _t("Directory"),
                    doc: _t("Document"),
                    pln: _t("Planning"),
                    rpg: _t("Reporting"),
                    cmd: _t("Actions"),
                };
                const groups = new Map();
                for (const bookmark of bookmarks) {
                    const key = order.includes(bookmark.category) ? bookmark.category : "cmd";
                    if (!groups.has(key)) {
                        groups.set(key, { id: key, name: labels[key], bookmarks: [] });
                    }
                    groups.get(key).bookmarks.push(bookmark);
                }
                return order.filter((key) => groups.has(key)).map((key) => groups.get(key));
            },
            addBookmark(bookmark) {
                if (state.bookmarks.some((existing) => existing.href === bookmark.href)) {
                    notification.add(_t("This view is already bookmarked."), { type: "info" });
                    return;
                }
                state.bookmarks = [...state.bookmarks, bookmark];
                persist("saturn_bookmarks", JSON.stringify(state.bookmarks));
                notification.add(_t("The bookmark has been saved."), { type: "success" });
            },
            removeBookmark(href) {
                state.bookmarks = state.bookmarks.filter((bookmark) => bookmark.href !== href);
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
                const reported = session.saturn?.color_scheme;
                if (reported === "light" || reported === "dark") {
                    return reported;
                }
                return cookie.get("color_scheme") === "light" ? "light" : "dark";
            },
            async switchColorScheme() {
                const target = this.scheme === "dark" ? "light" : "dark";
                // Cookie for this browser, setting so the choice survives a
                // cookie reset and follows the user to another one.
                cookie.set("color_scheme", target);
                await Promise.resolve(user.setUserSettings("color_scheme", target)).catch(() => {});
                browser.location.reload();
            },
            get companyId() {
                return (
                    session.saturn?.company_id ||
                    session.user_companies?.current_company ||
                    session.company_id ||
                    1
                );
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
                if (session.saturn?.has_logo) {
                    return `/web/image/res.company/${this.companyId}/saturn_logo`;
                }
                return this.brandLogo(false);
            },
            get logoMiniUrl() {
                if (session.saturn?.has_logo_mini) {
                    return `/web/image/res.company/${this.companyId}/saturn_logo_mini`;
                }
                return this.brandLogo(true);
            },
            /** Drawer background, or null to fall back on the CSS gradient. */
            get backgroundUrl() {
                return session.saturn?.has_background
                    ? `/web/image/res.company/${this.companyId}/saturn_background`
                    : null;
            },
        };

        return service;
    },
};

registry.category("services").add("saturn", saturnService);
