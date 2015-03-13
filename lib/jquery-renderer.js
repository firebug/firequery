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
const { VariablesView } = Cu.import("resource:///modules/devtools/VariablesView.jsm", {});

const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * @widget This object represents a widget that is used to render
 * generic jQuery object preview.
 */
var JQueryRenderer = {
  byKind: "jQuery",

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
          this.renderEmptySlots(emptySlots);
          emptySlots = 0;
        }

        let shortVal = this.message.shortenValueGrip(item);
        let elem = this.message._renderValueGrip(shortVal, { concise: true });
        this.element.appendChild(elem);

        this.renderCache(item, elem);
      }
    }

    if (emptySlots) {
      renderSeparator();
      this.renderEmptySlots(emptySlots, false);
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

  renderEmptySlots: function(aNumSlots, aAppendComma=true) {
    let slotLabel = l10n.getStr("emptySlotLabel");
    let slotText = PluralForm.get(aNumSlots, slotLabel);
    this._text("<" + slotText.replace("#1", aNumSlots) + ">");
    if (aAppendComma) {
      this._text(", ");
    }
  },

  renderCache: function(elementGrip, parentNode) {
    let cacheGrip = elementGrip.preview ? elementGrip.preview.cache : null;
    if (!cacheGrip) {
      return;
    }

    // Render a little envelop sign if the element has jQuery data
    // associated. Clicking on the envelope opens the variable view
    // with detailed information.
    let node = this.document.createElementNS(XHTML_NS, "span");
    node.className = "cache"
    node.innerHTML = "&#9993;"
    parentNode.appendChild(node);

    // Click handler
    let clickHandler = this.onClickCache.bind(this, cacheGrip);
    this.message._addLinkCallback(node, clickHandler);
  },

  onClickCache: function(cacheGrip) {
    Trace.sysout("JQueryRenderer.onClickCache;", cacheGrip);

    // Open {@link VariablesView} displaying the jQuery object (cache).
    this.output.openVariablesView({
      label: VariablesView.getString(cacheGrip, { concise: true }),
      objectActor: cacheGrip,
      autofocus: true,
    });
  }
};

Widgets.ObjectRenderers.add(JQueryRenderer);

// Exports from this module
exports.JQueryRenderer = JQueryRenderer;
