import { onWillUnmount, useEffect, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";
import { ResizablePanel } from "@web/core/resizable_panel/resizable_panel";
import { browser } from "@web/core/browser/browser";
import { MenuTree } from "@saturn_backend/webclient/sidenav/menu_tree";
import { SaturnSubnav } from "@saturn_backend/webclient/sidenav/subnav";

const COLLAPSED_WIDTH = 56;
const HOVER_OPEN_DELAY = 130;
const HOVER_CLOSE_DELAY = 220;

export class SaturnSidenav extends MenuTree {
    static template = "saturn_backend.Sidenav";
    static components = { ResizablePanel };
    static props = {};

    setup() {
        super.setup();
        this.commandService = useService("command");
        // The ui service is reactive: `isSmall` flips when the breakpoint is
        // crossed, so the sidebar follows it live.
        this.ui = useState(useService("ui"));
        this.state = useState(this.saturn.state);

        this.subnav = usePopover(SaturnSubnav, {
            position: "right-start",
            popoverClass: "sidenav_2nd fs-6",
            animation: false,
        });
        this.openTimer = null;
        this.closeTimer = null;
        // A timer still armed after teardown would open a popover from a
        // destroyed component.
        onWillUnmount(() => {
            browser.clearTimeout(this.openTimer);
            browser.clearTimeout(this.closeTimer);
        });

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
        return !this.ui.isSmall;
    }

    get panelClass() {
        const classes = ["o_sidenav", "position-fixed", "z-2", "start-0"];
        if (this.state.collapsed) {
            classes.push("sm");
        }
        return classes.join(" ");
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
        return this.menuService.getCurrentApp()?.id === app.id;
    }

    // -------------------------------------------------------------------------
    // Hover flyout
    // -------------------------------------------------------------------------
    onAppHover(app, ev) {
        const target = ev.currentTarget;
        browser.clearTimeout(this.closeTimer);
        browser.clearTimeout(this.openTimer);
        if (!this.saturn.sectionsOf(app).length) {
            this.subnav.close();
            return;
        }
        this.openTimer = browser.setTimeout(() => {
            // The row can be gone by now (breakpoint change, mode switch);
            // anchoring a popover to a detached node places it at 0,0 with no
            // way to dismiss it by leaving the sidebar.
            if (!target.isConnected) {
                return;
            }
            this.subnav.open(target, {
                app,
                maxHeight: this.flyoutMaxHeight(target),
                onMouseEnter: () => browser.clearTimeout(this.closeTimer),
                onMouseLeave: () => this.scheduleSubnavClose(),
            });
        }, HOVER_OPEN_DELAY);
    }

    /**
     * Room the flyout can take next to its row: it opens downwards from the
     * row, or upwards ending at it, whichever side is taller. Capping the
     * height there makes the wrapping column layout spill into another column
     * instead of running off the bottom of the screen.
     */
    flyoutMaxHeight(target) {
        const rect = target.getBoundingClientRect();
        const below = browser.innerHeight - rect.top;
        const above = rect.bottom;
        return Math.max(160, Math.floor(Math.max(below, above) - 12));
    }

    scheduleSubnavClose() {
        browser.clearTimeout(this.openTimer);
        browser.clearTimeout(this.closeTimer);
        this.closeTimer = browser.setTimeout(() => this.subnav.close(), HOVER_CLOSE_DELAY);
    }

    onSidenavLeave(ev) {
        // Moving onto the flyout itself must not close it.
        if (ev.relatedTarget?.closest?.(".sidenav_2nd")) {
            return;
        }
        this.scheduleSubnavClose();
    }

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------
    onAppClick(app, ev) {
        ev.preventDefault();
        this.subnav.close();
        this.menuService.selectMenu(app);
    }

    onAppDrill(app, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.subnav.close();
        this.saturn.openAppMenu(app);
    }

    onResize(width) {
        if (!this.state.collapsed) {
            this.saturn.setWidth(width);
        }
    }

    openCommandPalette() {
        this.commandService.openMainPalette();
    }

    openActivityHub() {
        // Re-use the systray activity menu rather than duplicating it.
        const toggle = document.querySelector(".o_menu_systray .fa-clock-o");
        (toggle?.closest("button") || toggle)?.click();
    }
}

registry.category("main_components").add("saturn.Sidenav", { Component: SaturnSidenav });
