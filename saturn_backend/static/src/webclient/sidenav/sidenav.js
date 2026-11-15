/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useEffect } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";
import { browser } from "@web/core/browser/browser";
import { debounce } from "@web/core/utils/timing";
import { isMacOS } from "@web/core/browser/feature_detection";
import { MenuTree } from "@saturn_backend/webclient/sidenav/menu_tree";
import { SaturnSubnav } from "@saturn_backend/webclient/sidenav/subnav";

const { useExternalListener, onWillUnmount } = owl.hooks;

const COLLAPSED_WIDTH = 56;
const HOVER_OPEN_DELAY = 130;
const HOVER_CLOSE_DELAY = 220;
// Bootstrap's `md` breakpoint, which is where Odoo 15 itself turns "small".
const SMALL_MAX_WIDTH = 767;

export class SaturnSidenav extends MenuTree {
    setup() {
        super.setup();
        this.popover = usePopover();
        this.closeSubnav = null;
        this.openTimer = null;
        this.closeTimer = null;
        // A timer still armed after teardown would open a popover from a
        // destroyed component.
        onWillUnmount(() => {
            browser.clearTimeout(this.openTimer);
            browser.clearTimeout(this.closeTimer);
        });

        // Nothing in Odoo 15 is reactive to the breakpoint, so follow the
        // window ourselves.
        useExternalListener(window, "resize", debounce(() => this.render(), 100));

        // The panel is fixed, so the web client itself has to reserve the room.
        useEffect(
            (visible, collapsed, stateWidth) => {
                const width = collapsed ? COLLAPSED_WIDTH : stateWidth;
                const root = document.documentElement;
                root.style.setProperty("--uw-sidenav", `${visible ? width : 0}px`);
                document.body.classList.toggle("saturn-nolside", !visible);
                return () => {
                    root.style.removeProperty("--uw-sidenav");
                    document.body.classList.remove("saturn-nolside");
                };
            },
            () => [this.visible, this.state.collapsed, this.state.width]
        );
    }

    get visible() {
        return window.innerWidth > SMALL_MAX_WIDTH;
    }

    get apps() {
        return this.saturn.apps;
    }

    get sections() {
        return this.saturn.navSections;
    }

    get recents() {
        return this.state.recents;
    }

    isCurrentApp(app) {
        const current = this.saturn.currentApp;
        return !!current && current.id === app.id;
    }

    // -------------------------------------------------------------------------
    // Hover flyout
    // -------------------------------------------------------------------------
    hideSubnav() {
        // Also disarm a pending open: a click lands well inside the hover
        // delay, and the flyout would otherwise open over the new view.
        browser.clearTimeout(this.openTimer);
        if (this.closeSubnav) {
            this.closeSubnav();
            this.closeSubnav = null;
        }
    }

    onAppHover(app, ev) {
        const target = ev.currentTarget;
        browser.clearTimeout(this.closeTimer);
        browser.clearTimeout(this.openTimer);
        if (!this.saturn.sectionsOf(app).length) {
            this.hideSubnav();
            return;
        }
        this.openTimer = browser.setTimeout(() => {
            // The row can be gone by now (breakpoint change, mode switch);
            // anchoring a popover to a detached node places it at 0,0 with no
            // way to dismiss it by leaving the sidebar.
            if (!target.isConnected) {
                return;
            }
            this.hideSubnav();
            this.closeSubnav = this.popover.add(
                target,
                SaturnSubnav,
                {
                    app,
                    close: () => this.hideSubnav(),
                    maxHeight: this.flyoutMaxHeight(target),
                    onMouseEnter: () => browser.clearTimeout(this.closeTimer),
                    onMouseLeave: () => this.scheduleSubnavClose(),
                },
                { position: "right", popoverClass: "sidenav_2nd" }
            );
        }, HOVER_OPEN_DELAY);
    }

    /**
     * Room the flyout can take next to its row. Odoo 15 positions it on
     * whichever side of the row fits, so the larger of the two decides; past
     * that height the wrapping column layout spills into a second column
     * instead of running off the screen.
     */
    flyoutMaxHeight(target) {
        const rect = target.getBoundingClientRect();
        const below = window.innerHeight - rect.top;
        const above = rect.bottom;
        return Math.max(160, Math.floor(Math.max(below, above) - 12));
    }

    scheduleSubnavClose() {
        browser.clearTimeout(this.openTimer);
        browser.clearTimeout(this.closeTimer);
        this.closeTimer = browser.setTimeout(() => this.hideSubnav(), HOVER_CLOSE_DELAY);
    }

    onSidenavLeave(ev) {
        // Moving onto the flyout itself must not close it.
        if (ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest(".sidenav_2nd")) {
            return;
        }
        this.scheduleSubnavClose();
    }

    // -------------------------------------------------------------------------
    // Resize handle
    // -------------------------------------------------------------------------
    onResizeStart(ev) {
        if (this.state.collapsed) {
            return;
        }
        ev.preventDefault();
        const rtl = document.body.classList.contains("o_rtl");
        const onMove = (moveEv) => {
            const width = rtl ? window.innerWidth - moveEv.clientX : moveEv.clientX;
            this.saturn.setWidth(Math.min(width, Math.round(window.innerWidth * 0.6)));
        };
        const onUp = () => {
            document.body.classList.remove("saturn-resizing");
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        document.body.classList.add("saturn-resizing");
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------
    onAppClick(app, ev) {
        ev.preventDefault();
        this.hideSubnav();
        this.saturn.selectMenu(app);
    }

    onAppDrill(app, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.hideSubnav();
        this.saturn.openAppMenu(app);
    }

    onToggleCollapsed() {
        this.hideSubnav();
        this.saturn.toggleCollapsed();
    }

    onSwitchScheme() {
        this.saturn.switchColorScheme();
    }

    onWorkspaceClick() {
        this.saturn.toggleIsland("space");
    }

    onBackToApps() {
        this.saturn.backToApps();
    }

    onMenuMode() {
        this.saturn.setNavMode("menu");
    }

    setFootMode(mode) {
        this.saturn.setFootMode(mode);
    }

    onClearRecents() {
        this.saturn.clearRecents();
    }

    openCommandPalette() {
        // The command service of Odoo 15 keeps its palette private and only
        // opens it from the Ctrl+K hotkey, so replay that hotkey.
        const mac = isMacOS();
        window.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "k",
                code: "KeyK",
                ctrlKey: !mac,
                metaKey: mac,
                bubbles: true,
            })
        );
    }

    openActivityHub(ev) {
        // Re-use the systray activity menu rather than duplicating it. It is a
        // Bootstrap dropdown, which closes on any click that reaches the
        // document — including the one being handled right now.
        ev.stopPropagation();
        const icon = document.querySelector(".o_menu_systray .o_mail_systray_item .fa-clock-o");
        const toggle = icon && icon.closest("a");
        if (toggle) {
            toggle.click();
        }
    }
}
SaturnSidenav.template = "saturn_backend.Sidenav";

registry.category("main_components").add("saturn.Sidenav", { Component: SaturnSidenav });
