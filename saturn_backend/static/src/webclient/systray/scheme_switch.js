/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useSaturn } from "@saturn_backend/core/saturn_service";

const { Component } = owl;

/**
 * Colour scheme toggle in the systray.
 *
 * The sidebar toolbar carries the same action, but the sidebar is hidden while
 * the app drawer is open, and the systray is lifted above the drawer — so this
 * is the copy that stays reachable from every screen.
 */
export class SaturnSchemeSwitch extends Component {
    setup() {
        this.saturn = useSaturn();
    }

    onClick() {
        this.saturn.switchColorScheme();
    }
}
SaturnSchemeSwitch.template = "saturn_backend.SchemeSwitch";

export const saturnSchemeSwitchItem = { Component: SaturnSchemeSwitch };

// Systray entries are sorted by sequence and then reversed, so a high sequence
// puts this at the left end of the systray.
registry.category("systray").add("saturn.scheme_switch", saturnSchemeSwitchItem, { sequence: 100 });
