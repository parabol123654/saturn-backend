/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { browser } from "@web/core/browser/browser";
import { session } from "@web/session";
import { useBus } from "@web/core/utils/hooks";

const { EventBus } = owl.core;
const { useComponent } = owl.hooks;

const MAX_RECENTS = 14;
const DEFAULT_WIDTH = 243;
const MIN_WIDTH = 186;

// Scoped per database and user: one origin can serve several databases, and a
// browser profile is often shared, so a single key would show one user the
// record names of another.
function recentsKey() {
    return `saturn.recents.${session.db || "db"}.${session.uid || "anon"}`;
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
    } catch (_error) {
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

/** Address of the current view. Odoo 15 keeps it in the URL hash. */
export function currentHref() {
    const { pathname, search, hash } = browser.location;
    return pathname + search + hash;
}

// The service is also needed from the legacy control panel, which lives in the
// legacy environment and so cannot reach it through `useService`.
let instance = null;

/**
 * Gives a component the chrome service and re-renders it whenever the shared
 * state changes. Owl 1 has no shared reactive objects (`useState` observes per
 * component), so the service publishes its changes on a bus instead.
 */
export function useSaturn() {
    const component = useComponent();
    useBus(instance.bus, "UPDATE", () => component.render());
    return instance;
}

/**
 * Holds every piece of chrome state that the side navigation, the navbar and
 * the app drawer share, and mirrors the persistent part of it onto
 * ``res.users.settings``.
 */
export const saturnService = {
    dependencies: ["menu", "action", "notification", "orm", "cookie"],
    start(env, { menu, action, notification, orm, cookie }) {
        const info = session.saturn || {};
        const settings = info.settings || {};
        const RECENTS_KEY = recentsKey();
        const bus = new EventBus();

        // Several keys are often written in one go; publish once per tick.
        let scheduled = false;
        function notify() {
            if (scheduled) {
                return;
            }
            scheduled = true;
            Promise.resolve().then(() => {
                scheduled = false;
                bus.trigger("UPDATE");
            });
        }

        // Every write goes through this proxy, so assigning a key anywhere is
        // enough to refresh the components subscribed with `useSaturn`.
        // Collections are always replaced, never mutated in place.
        const state = new Proxy(
            {
                // Side navigation
                navMode: settings.saturn_nav_mode === "menu" ? "menu" : "apps",
                navAppId: null, // app pinned in "menu" mode; null == follow current app
                footMode: "recent", // "recent" | "menu"
                collapsed: !!settings.saturn_sidenav_collapsed,
                // Clamped on the way in too: a stored value below MIN_WIDTH would
                // otherwise survive every reload, since setWidth only runs on drag.
                width: clampWidth(settings.saturn_sidenav_width),
                closedSections: {},
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
            },
            {
                set(target, key, value) {
                    if (target[key] !== value) {
                        target[key] = value;
                        notify();
                    }
                    return true;
                },
            }
        );

        // Keep the cookie in step with the scheme the server resolved, so the
        // next request is answered with the same bundle even before the user
        // has ever used the switch.
        const resolvedScheme = info.color_scheme;
        if (
            (resolvedScheme === "light" || resolvedScheme === "dark") &&
            cookie.current.color_scheme !== resolvedScheme
        ) {
            cookie.setCookie("color_scheme", resolvedScheme);
        }

        function persist(key, value) {
            // Silently ignore write failures: the chrome must keep working even
            // when the user cannot store settings (readonly db...).
            return Promise.resolve(
                orm.call("res.users.settings", "saturn_set_settings", [{ [key]: value }])
            ).catch(() => {});
        }

        let widthTimer = null;
        function persistWidth(width) {
            browser.clearTimeout(widthTimer);
            widthTimer = browser.setTimeout(() => persist("saturn_sidenav_width", width), 600);
        }

        function storeRecents() {
            try {
                browser.localStorage.setItem(RECENTS_KEY, JSON.stringify(state.recents));
            } catch (_error) {
                // storage full or disabled - recents are a convenience only
            }
        }

        function isHomeUrl() {
            const path = browser.location.pathname.replace(/\/+$/, "");
            const hash = browser.location.hash.replace(/^#/, "");
            return (path === "/web" || path === "") && !hash;
        }

        // `title` is the breadcrumb label the legacy views publish: the record
        // name on a form, where the action name would only say which list it
        // belongs to. The new views (graph, pivot) publish none, and a form
        // without a record (a new one, or Settings) is titled "New", which
        // names nothing — both fall back to the action name.
        function controllerName(controller) {
            if (!controller) {
                return "";
            }
            const hash = browser.location.hash;
            const blankForm = /[#&]view_type=form(&|$)/.test(hash) && !/[#&]id=\d+/.test(hash);
            const action = controller.action || {};
            return (!blankForm && controller.title) || action.display_name || action.name || "";
        }

        function hashParam(href, key) {
            const match = new RegExp(`[#&]${key}=([^&]*)`).exec(href || "");
            return match ? match[1] : "";
        }

        // Two addresses can name the same place: Odoo adds parameters to the
        // hash after the fact (`active_id`, `cids`). Same label, same action
        // and same record is the same recent.
        function recentKey(recent) {
            const href = recent.href;
            return [recent.name, hashParam(href, "action") || hashParam(href, "model"), hashParam(href, "id")].join("|");
        }

        // The drawer takes over the whole screen, so it doubles as the home
        // screen: landing on /web without an action opens it. (Odoo 15 then
        // opens the first app on its own, which dismisses it again.)
        state.islandOpen = isHomeUrl();

        // Navigating from anywhere else (breadcrumb, browser back, a command)
        // dismisses the drawer. Picking an app closes it explicitly, so the
        // only thing this must not do is swallow a deliberate open that lands
        // while the action underneath is still mounting — that action fires
        // UI-UPDATED for the controller that was already current. Comparing
        // controllers rather than elapsed time keeps a real navigation (Back,
        // a command) closing the drawer no matter how soon it happens.
        let openedOver = null;
        env.bus.on("ACTION_MANAGER:UI-UPDATED", null, () => {
            if (action.currentController !== openedOver) {
                state.islandOpen = false;
                state.search = "";
                openedOver = null;
            }
            // The router pushes the new hash on a timer, after this event: wait
            // for it, or the recent would be filed under the previous address.
            browser.setTimeout(() => {
                trackRecent();
                notify();
            }, 50);
        });

        env.bus.on("MENUS:APP-CHANGED", null, () => {
            // Follow the app that is actually open again.
            state.navAppId = null;
            notify();
        });

        // Browser back/forward changes the hash without a new controller.
        browser.addEventListener("hashchange", notify);

        function trackRecent() {
            const name = controllerName(action.currentController);
            if (!name) {
                return;
            }
            const entry = { name, href: currentHref() };
            const key = recentKey(entry);
            const recents = state.recents.filter((recent) => recentKey(recent) !== key);
            recents.unshift(entry);
            state.recents = recents.slice(0, MAX_RECENTS);
            storeRecents();
        }

        const service = {
            state,
            bus,
            MIN_WIDTH,
            DEFAULT_WIDTH,

            // ---------------------------------------------------------------
            // Apps
            // ---------------------------------------------------------------
            get apps() {
                return menu
                    .getApps()
                    .filter((app) => app.actionID || (app.children && app.children.length));
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
            /** Id of the action on screen, used to highlight its menu entry. */
            get currentActionId() {
                const controller = action.currentController;
                return controller && controller.action ? controller.action.id : null;
            },
            /** Name of the view on screen, used to label a bookmark. */
            get currentTitle() {
                return controllerName(action.currentController) || document.title;
            },
            /** App whose menus are shown in "menu" mode. */
            get navApp() {
                const current = this.currentApp;
                const appId = state.navAppId || (current && current.id);
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
                    if (child.childrenTree && child.childrenTree.length) {
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
             * Address of a menu. Odoo 15 routes on the URL hash, and a menu
             * record carries no ready-made link.
             */
            menuHref(entry) {
                if (!entry) {
                    return "#";
                }
                const parts = [`menu_id=${entry.id}`];
                if (entry.actionID) {
                    parts.push(`action=${entry.actionID}`);
                }
                return "/web#" + parts.join("&");
            },
            /**
             * Image source of an app icon. Odoo 15 sends the bare base64
             * payload, without the `data:` prefix later versions add.
             */
            iconSrc(app) {
                const data = app && app.webIconData;
                if (!data) {
                    return null;
                }
                if (data.startsWith("data:") || data.startsWith("/")) {
                    return data;
                }
                const isSvg = data.startsWith("PD") || data.startsWith("PHN2");
                return `data:${isSvg ? "image/svg+xml" : "image/png"};base64,${data}`;
            },
            selectMenu(entry) {
                return menu.selectMenu(entry);
            },
            getMenu(menuId) {
                return menu.getMenu(menuId);
            },
            getAllMenus() {
                return menu.getAll();
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
                state.closedSections = Object.assign({}, state.closedSections, {
                    [sectionId]: !state.closedSections[sectionId],
                });
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
                const reported = info.color_scheme;
                if (reported === "light" || reported === "dark") {
                    return reported;
                }
                return cookie.current.color_scheme === "light" ? "light" : "dark";
            },
            async switchColorScheme() {
                const target = this.scheme === "dark" ? "light" : "dark";
                // Cookie for this browser, setting so the choice survives a
                // cookie reset and follows the user to another one.
                cookie.setCookie("color_scheme", target);
                await persist("color_scheme", target);
                browser.location.reload();
            },
            get companyId() {
                return (
                    info.company_id ||
                    (session.user_companies && session.user_companies.current_company) ||
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

        instance = service;
        return service;
    },
};

registry.category("services").add("saturn", saturnService);
