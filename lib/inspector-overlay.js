/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const self = require("sdk/self");
const { Cu, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { loadSheet, removeSheet } = require("sdk/stylesheet/utils");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");
const { Dom } = require("firebug.sdk/lib/core/dom.js");

// Constants
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * @overlay This object represents an overlay for the existing
 * Inspector panel it's responsible for the panel customization.
 * FireQuery is rendering additional info related to jQuery objects.
 */
const InspectorOverlay = Class(
/** @lends InspectorOverlay */
{
  extends: PanelOverlay,

  overlayId: "fireQueryInspectorOverlay",
  panelId: "inspector",

  // Initialization

  initialize: function(options) {
    PanelOverlay.prototype.initialize.apply(this, arguments);

    Trace.sysout("InspectorOverlay.initialize;", options);

    this.onMarkupViewRender = this.onMarkupViewRender.bind(this);
    this.onMarkupViewLoaded = this.onMarkupViewLoaded.bind(this);
    this.onContentMessage = this.onContentMessage.bind(this);
  },

  destroy: function() {
    Trace.sysout("InspectorOverlay.destroy;", arguments);
  },

  // Events

  onBuild: function(options) {
    PanelOverlay.prototype.onBuild.apply(this, arguments);

    Trace.sysout("InspectorOverlay.onBuild;", options);

    // Handle MarkupView events.
    this.panel.on("markupview-render", this.onMarkupViewRender);
    this.panel.on("markuploaded", this.onMarkupViewLoaded);
  },

  onReady: function(options) {
    PanelOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("InspectorOverlay.onReady;", options);
  },

  // MarkupView Event Handlers

  /**
   * xxxHonza: unload all on destroy/disable/uninstall.
   */
  onMarkupViewLoaded: function() {
    Trace.sysout("inspectorOverlay.onMarkupViewLoaded;");

    let frame = this.panel._markupFrame;
    let win = frame.contentWindow;
    let doc = win.document;

    loadSheet(win, "chrome://firequery/skin/firequery.css", "author");

    let requireUrl = self.data.url("./lib/require.js");
    let configUrl = self.data.url("./inspector-config.js");

    // Require configuration script. It's hardcoded here, so the
    // base URL can be dynamically provided. Note that base URL of
    // the markup frame is pointing into native DevTools chrome location.
    let configScript =
      "require.config({\n" +
      "  baseUrl: '" + self.data.url() + "',\n" +
      "  paths: {'react': './lib/react'}\n" +
      "});\n" +
      "requirejs(['inspector']);\n";

    // As soon as the RequireJS library is loaded, execute also
    // configuration script that loads the main module ('inspector').
    Dom.loadScript(doc, requireUrl, event => {
      Dom.addScript(doc, "firequery-inspector-config", configScript);
      win.addEventListener("firequery/message", this.onContentMessage, true);
    });
  },

  onMarkupViewRender: function(eventId, node, type, data, options) {
    if (type != "element") {
      return;
    }

    let value;
    let nodeFront = data.node;
    let cache = nodeFront._form.jQueryCacheData;

    if (!cache) {
      return;
    }

    FBTrace.sysout("InspectorOverlay.onMarkupViewRender;", cache);

    let doc = node.ownerDocument;

    for (var data in cache) {
      if (cache.hasOwnProperty(data)) {
        let label = doc.createElementNS(XHTML_NS, "span");
        label.className = "fireQueryNodeData";
        label.innerHTML = JSON.stringify(cache[data]);
        node.appendChild(label);
      }
    }
  },

  // Communication: content <-> chrome

  onContentMessage: function(event) {
    Trace.sysout("InspectorOverlay.onContentMessage; ", event);

    let { data } = event;
    switch (data.type) {
    case "initialize":
      FBTrace.sysout("MarkupView content overlay initialized", event);
      break;
    }
  },

  /**
   * Send message to the content scope (panel's iframe)
   */
  postContentMessage: function(type, data) {
    let frame = this.panel._markupFrame;
    let win = frame.contentWindow;

    const event = new win.MessageEvent(type, {
      bubbles: true,
      cancelable: true,
      data: data,
    });

    win.dispatchEvent(event);
  },
});

// Exports from this module
exports.InspectorOverlay = InspectorOverlay;
