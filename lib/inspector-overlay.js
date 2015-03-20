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
    loadSheet(win, "chrome://firebug.sdk/skin/domTree.css", "author");

    let requireUrl = self.data.url("./lib/require.js");
    let configUrl = self.data.url("./inspector-config.js");

    // Require configuration script. It's hardcoded here, so the
    // base URL can be dynamically provided. Note that base URL of
    // the markup frame is pointing into native DevTools chrome location.
    // xxxHonza: should be in a *.js file
    let configScript =
      "require.config({" +
      "  baseUrl: '" + self.data.url() + "'," +
      "  paths: {" +
      "    'react': './lib/react'," +
      "    'firebug.sdk': '../node_modules/firebug.sdk'," +
      "    'reps': '../node_modules/firebug.sdk/lib/reps'," +
      "  }" +
      "});" +
      "requirejs(['markup-view-content']);";

    // First, load RequireJS library.
    Dom.loadScript(doc, requireUrl, event => {
      // As soon as the RequireJS library is loaded, execute also
      // configuration script that loads the main module.
      Dom.addScript(doc, "firequery-inspector-config", configScript);

      // Listen for messages from the content. The communication
      // is done through DOM events since the message manager
      // isn't available for the markup frame.
      win.addEventListener("firequery/content/message",
        this.onContentMessage, true);

      // xxxHonza: expose tracing to the content.
    });

    this.nodes = [];
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

    Trace.sysout("InspectorOverlay.onMarkupViewRender;", cache);

    // Create wrapper for data rendered as soon as markup view
    // content scripts are loaded (see: onContentOverlayInitialized)
    let doc = node.ownerDocument;
    let label = doc.createElementNS(XHTML_NS, "span");
    label.className = "fireQueryNodeData";
    node.appendChild(label);

    // List of nodes to render when the content overlay is
    // properly initialized (loaded).
    this.nodes.push({
      element: node,
      cache: cache
    });
  },

  // Communication: content <-> chrome

  onContentMessage: function(event) {
    Trace.sysout("InspectorOverlay.onContentMessage; ", event);

    let { data } = event;
    switch (data.type) {
    case "initialize":
      this.onContentOverlayInitialized();
      break;
    }
  },

  /**
   * Send message to the content scope (panel's iframe)
   */
  postContentMessage: function(type, args) {
    let frame = this.panel._markupFrame;
    let win = frame.contentWindow;

    var data = {
      type: type,
      args: args,
    };

    var event = new win.MessageEvent("firequery/chrome/message", {
      bubbles: true,
      cancelable: true,
      data: data,
    });

    win.dispatchEvent(event);
  },

  onContentOverlayInitialized: function() {
    Trace.sysout("InspectorOverlay.onContentOverlayInitialized; " +
      this.nodes.length, this.nodes);

    this.postContentMessage("render", this.nodes);
  }
});

// Helpers

// Exports from this module
exports.InspectorOverlay = InspectorOverlay;
