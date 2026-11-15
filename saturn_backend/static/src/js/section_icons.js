odoo.define("saturn_backend.section_icons", function () {
    "use strict";

    /**
     * Menu sections carry no icon in Odoo, so the sidebar derives one from the
     * section name. First keyword wins; unknown sections fall back to a neutral
     * glyph.
     */
    const RULES = [
        [/order|quotation|sale/i, "ri-file-list-3-line"],
        [/invoice|bill|payment|accounting/i, "ri-hourglass-line"],
        [/product|catalog|variant|price/i, "ri-box-3-line"],
        [/report|analys|dashboard|statistic/i, "ri-bar-chart-box-line"],
        [/config|setting|technical/i, "ri-settings-4-line"],
        [/customer|contact|partner|vendor|supplier/i, "ri-user-3-line"],
        [/employee|recruit|appraisal|people|team/i, "ri-team-line"],
        [/operation|transfer|manufactur|work|process/i, "ri-repeat-2-line"],
        [/plan|schedul|calendar|forecast/i, "ri-calendar-check-line"],
        [/inventory|stock|warehouse|lot|serial/i, "ri-archive-2-line"],
        [/project|task|timesheet/i, "ri-kanban-view-2"],
        [/website|page|shop|ecommerce/i, "ri-global-line"],
        [/mail|message|discuss|channel/i, "ri-chat-3-line"],
        [/document|attachment|file/i, "ri-folder-3-line"],
    ];

    const DEFAULT_ICON = "ri-apps-2-line";

    function sectionIcon(name) {
        for (const [pattern, icon] of RULES) {
            if (pattern.test(name || "")) {
                return icon;
            }
        }
        return DEFAULT_ICON;
    }

    return { sectionIcon };
});
