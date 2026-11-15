odoo.define("saturn_backend.SchemeSwitch", function (require) {
    "use strict";

    const SystrayMenu = require("web.SystrayMenu");
    const Widget = require("web.Widget");
    const saturn = require("saturn_backend.saturn");

    /**
     * Colour scheme toggle in the systray.
     *
     * The sidebar toolbar carries the same action, but the sidebar is hidden
     * while the app drawer is open, and the systray is lifted above the drawer
     * — so this is the copy that stays reachable from every screen.
     */
    const SchemeSwitch = Widget.extend({
        template: "saturn_backend.SchemeSwitch",
        // Systray items are sorted by sequence and then reversed, so a high
        // sequence puts this at the left end of the systray.
        sequence: 100,
        events: {
            click: "_onClick",
        },
        _onClick(ev) {
            ev.preventDefault();
            saturn.switchColorScheme();
        },
    });

    SystrayMenu.Items.push(SchemeSwitch);

    return SchemeSwitch;
});
