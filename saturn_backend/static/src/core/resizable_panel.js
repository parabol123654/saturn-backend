/** @odoo-module **/

import { Component, onMounted, useExternalListener, useRef } from "@odoo/owl";

/**
 * A panel whose width is dragged by a handle on its edge. Odoo only gained
 * `@web/core/resizable_panel` in 17, so this is the small part of it the side
 * navigation needs.
 */
export class ResizablePanel extends Component {
    setup() {
        this.containerRef = useRef("container");
        this.dragging = false;
        onMounted(() => this.resize(this.props.initialWidth));
        useExternalListener(document, "mousemove", (ev) => this.onMouseMove(ev));
        useExternalListener(document, "mouseup", () => this.onMouseUp());
    }

    onMouseDown() {
        this.dragging = true;
        document.body.classList.add("pe-none", "user-select-none");
    }

    onMouseUp() {
        if (this.dragging) {
            this.dragging = false;
            document.body.classList.remove("pe-none", "user-select-none");
        }
    }

    onMouseMove(ev) {
        const el = this.containerRef.el;
        if (!this.dragging || !el) {
            return;
        }
        const rect = el.getBoundingClientRect();
        const rtl = getComputedStyle(el).direction === "rtl";
        const end = this.props.handleSide === "end";
        const width = end !== rtl ? ev.clientX - rect.left : rect.right - ev.clientX;
        this.resize(Math.min(Math.max(this.props.minWidth, width), window.innerWidth - 10));
    }

    resize(width) {
        this.containerRef.el.style.setProperty("width", `${width}px`);
        this.props.onResize(width);
    }
}
ResizablePanel.template = "saturn_backend.ResizablePanel";
ResizablePanel.props = {
    onResize: { type: Function, optional: true },
    initialWidth: { type: Number, optional: true },
    minWidth: { type: Number, optional: true },
    class: { type: String, optional: true },
    handleSide: { validate: (side) => ["start", "end"].includes(side), optional: true },
    slots: { type: Object, optional: true },
};
ResizablePanel.defaultProps = {
    onResize: () => {},
    initialWidth: 400,
    minWidth: 400,
    class: "",
    handleSide: "end",
};
