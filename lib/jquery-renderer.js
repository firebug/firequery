/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Addon SDK
const { Cu, Ci } = require("chrome");
const { prefs } = require("sdk/simple-prefs");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { devtools, safeImport, safeRequire } = require("firebug.sdk/lib/core/devtools.js");

// See also: https://bugzilla.mozilla.org/show_bug.cgi?id=912121
const { VariablesView } = safeImport(
  "resource:///modules/devtools/client/shared/widgets/VariablesView.jsm",
  "resource:///modules/devtools/VariablesView.jsm");

const { Widgets } = safeRequire(devtools,
  "devtools/client/webconsole/console-output",
  "devtools/webconsole/console-output");

// Platform
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * @widget This object represents a widget that is used to render
 * generic jQuery object preview in the Console panel.
 *
 * Read more about Object renderers API on MDN:
 * https://developer.mozilla.org/en-US/docs/Tools/Web_Console/Custom_output#Object_renderers_API
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

    // Keep in mind that only specified maximum number of items
    // is rendered in the Console panel.
    let maxItemsRendered = prefs.maxItemsRendered || 400;

    // Iterate over the array and render all items.
    var shown = 0;
    for (let item of items) {
      if (maxItemsRendered-- < 0) {
        break;
      }

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

        // shortenValueGrip API has been introduced in Firefox 38
        let shortVal = this.message.shortenValueGrip ?
          this.message.shortenValueGrip(item) : shortenValueGrip(item);

        let elem = this.message._renderValueGrip(shortVal, { concise: true });
        this.element.appendChild(elem);

        this.renderData(item, elem);
      }

      shown++;
    }

    if (emptySlots) {
      renderSeparator();
      this.renderEmptySlots(emptySlots, false);
    }

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

  renderData: function(elementGrip, parentNode) {
    let dataGrip = elementGrip.preview ? elementGrip.preview.jQueryData : null;
    if (!dataGrip) {
      return;
    }

    // Render a little envelop sign if the element has jQuery data
    // associated. Clicking on the envelope opens the variable view
    // with detailed information.
    let node = this.document.createElementNS(XHTML_NS, "span");
    node.className = "data"
    node.innerHTML = "&#9993;"
    parentNode.appendChild(node);

    // Click handler
    let clickHandler = this.onClickData.bind(this, dataGrip);
    this.message._addLinkCallback(node, clickHandler);
  },

  onClickData: function(dataGrip) {
    Trace.sysout("JQueryRenderer.onClickData;", dataGrip);

    // Open {@link VariablesView} displaying jQuery data.
    this.output.openVariablesView({
      label: VariablesView.getString(dataGrip, { concise: true }),
      objectActor: dataGrip,
      autofocus: true,
    });
  }
};

// Helpers

/**
 * Can be removed when Firefox 38 (Fx38) is the minimum required version.
 */
function shortenValueGrip(grip) {
  let MAX_STRING_GRIP_LENGTH = 36;
  let ELLIPSIS = Services.prefs.getComplexValue("intl.ellipsis",
    Ci.nsIPrefLocalizedString).data;

  let shortVal = grip;
  if (typeof(grip)=="string") {
    shortVal = grip.replace(/(\r\n|\n|\r)/gm," ");
    if (shortVal.length > MAX_STRING_GRIP_LENGTH) {
      shortVal = shortVal.substring(0, MAX_STRING_GRIP_LENGTH - 1) + ELLIPSIS;
    }
  }

  return shortVal;
}

// Registration

Widgets.ObjectRenderers.add(JQueryRenderer);

// Exports from this module
exports.JQueryRenderer = JQueryRenderer;
