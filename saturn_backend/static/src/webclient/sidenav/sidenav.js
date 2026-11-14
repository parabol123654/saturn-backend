import { onWillUnmount, useEffect } from "@odoo/owl";
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

    setup() {
        super.setup();
        this.commandService = useService("command");
        // `env.isSmall` is gone in Odoo 20; the ui service's getter reads a
        // signal, so the sidebar still follows the breakpoint live.
        this.ui = useService("ui");
        this.state = this.saturn.state;

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
        // An Owl 3 effect tracks what it reads, so collapsing, resizing and
        // crossing the breakpoint all re-run it without a dependency list.
        useEffect(() => {
            const visible = this.visible;
            const width = this.state.collapsed ? COLLAPSED_WIDTH : this.state.width;
            const root = document.documentElement;
            root.style.setProperty("--uw-sidenav", `${visible ? width : 0}px`);
            document.body.classList.toggle("saturn-nolside", !visible);
            return () => {
                root.style.removeProperty("--uw-sidenav");
                document.body.classList.remove("saturn-nolside");
            };
        });
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
                onMouseEnter: () => browser.clearTimeout(this.closeTimer),
                onMouseLeave: () => this.scheduleSubnavClose(),
            });
        }, HOVER_OPEN_DELAY);
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
        // Re-use the systray activity menu rather than duplicating it. Odoo 20
        // draws its button with the `oi` icon font instead of FontAwesome.
        const toggle = document.querySelector(
            ".o_menu_systray .oi[data-icon='schedule'], .o_menu_systray .o-mail-ActivityMenu"
        );
        (toggle?.closest("button") || toggle)?.click();
    }
}

registry.category("main_components").add("saturn.Sidenav", { Component: SaturnSidenav });
