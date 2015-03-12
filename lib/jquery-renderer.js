/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const { Cu, Ci } = require("chrome");
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { Widgets } = devtools.require("devtools/webconsole/console-output");

/**
 * @widget This object represents a widget that is used to render
 * generic jQuery object preview.
 *
 * xxxHonza: Use envelope "&#9993;" to indicate jQuery data.

 */
var JQueryRenderer = {
  byKind: "jQueryObject",

  render: function() {
    let { preview } = this.objectActor;
    let { items } = preview;

    this.element = this.el("span.kind-" + preview.kind);
    this._anchor(preview.kind, { className: "cm-variable" });

    if (!items || this.options.concise) {
      this._text("(");
      this.element.appendChild(this.el("span.cm-number", preview.length));
      this._text(")");
      return this;
    }

    this._text(" ( ");

    let isFirst = true;
    let emptySlots = 0;
    // A helper that renders a comma between items if isFirst == false.
    let renderSeparator = () => !isFirst && this._text(", ");

    for (let item of items) {
      if (item === null) {
        emptySlots++;
      }
      else {
        renderSeparator();
        isFirst = false;

        if (emptySlots) {
          this._renderEmptySlots(emptySlots);
          emptySlots = 0;
        }

        let shortVal = this.message.shortenValueGrip(item);
        let elem = this.message._renderValueGrip(shortVal, { concise: true });
        this.element.appendChild(elem);
      }
    }

    if (emptySlots) {
      renderSeparator();
      this._renderEmptySlots(emptySlots, false);
    }

    let shown = items.length;
    if (shown < preview.length) {
      this._text(", ");

      let n = preview.length - shown;
      let str = VariablesView.stringifiers._getNMoreString(n);
      this._anchor(str);
    }

    this._text(" )");
  },

  _renderEmptySlots: function(aNumSlots, aAppendComma=true) {
    let slotLabel = l10n.getStr("emptySlotLabel");
    let slotText = PluralForm.get(aNumSlots, slotLabel);
    this._text("<" + slotText.replace("#1", aNumSlots) + ">");
    if (aAppendComma) {
      this._text(", ");
    }
  },
};

Widgets.ObjectRenderers.add(JQueryRenderer);

// Exports from this module
exports.JQueryRenderer = JQueryRenderer;
