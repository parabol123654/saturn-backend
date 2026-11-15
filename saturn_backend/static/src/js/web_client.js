odoo.define("saturn_backend.WebClient", function (require) {
    "use strict";

    const core = require("web.core");
    const WebClient = require("web.WebClient");
    const saturn = require("saturn_backend.saturn");
    const SaturnIsland = require("saturn_backend.Island");
    const { SaturnSidenav, SaturnSubnav } = require("saturn_backend.Sidenav");

    /**
     * Odoo 14 still runs the legacy web client: there is no registry of main
     * components to add the chrome to, so the web client itself mounts the
     * sidebar, the flyout and the drawer on the body once its menus are
     * loaded, and forwards what the shared state needs to know — the menu
     * tree, the current app, the displayed action and URL changes.
     */
    WebClient.include({
        start() {
            saturn.attach(this);
            core.bus.on("change_menu_section", this, (menuId) => saturn.onAppChanged(menuId));
            return this._super(...arguments);
        },

        instanciate_menu_widgets() {
            return Promise.resolve(this._super(...arguments)).then((result) => {
                saturn.setMenuData(this.menu_data);
                this._saturnDecorateNavbar();
                return this._saturnMount().then(() => result);
            });
        },

        /** Mount the Owl chrome once; menu reloads only refresh its data. */
        _saturnMount() {
            if (this._saturnComponents) {
                return Promise.resolve();
            }
            this._saturnComponents = [new SaturnSidenav(), new SaturnSubnav(), new SaturnIsland()];
            return Promise.all(
                this._saturnComponents.map((component) => component.mount(document.body))
            );
        },

        /**
         * The apps dropdown, brand and section menus are hidden by the
         * stylesheet; what the navbar gets instead is the drawer toggle and,
         * for small screens where the sidebar is gone, the compact logo.
         */
        _saturnDecorateNavbar() {
            const navbar = this.menu && this.menu.el && this.menu.el.querySelector(".o_main_navbar");
            if (!navbar || navbar.querySelector("#island_toggler")) {
                return;
            }
            const stock = navbar.querySelector(".o_menu_apps a[accesskey]");
            if (stock) {
                stock.removeAttribute("accesskey");
            }
            const wrap = document.createElement("div");
            wrap.className = "u_navbar_start d-flex align-items-center";
            const toggler = document.createElement("button");
            toggler.id = "island_toggler";
            toggler.type = "button";
            toggler.className = "btn d-flex px-1";
            toggler.title = core._t("Main Menu");
            toggler.accessKey = "h";
            toggler.innerHTML = '<i class="ri-apps-2-line"></i>';
            toggler.addEventListener("click", () => saturn.toggleIsland("pick"));
            const logo = document.createElement("a");
            logo.className = "u_navbar_logo align-items-center";
            logo.href = "/web";
            const img = document.createElement("img");
            img.src = saturn.logoMiniUrl;
            img.alt = "";
            logo.appendChild(img);
            wrap.appendChild(toggler);
            wrap.appendChild(logo);
            navbar.insertBefore(wrap, navbar.firstChild);
        },

        current_action_updated(action, controller) {
            this._super(...arguments);
            saturn.onActionUpdated(action, controller);
        },

        do_push_state() {
            this._super(...arguments);
            saturn.onStatePushed();
        },
    });
});
