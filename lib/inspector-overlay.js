/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const { Cu, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { loadSheet, removeSheet } = require("sdk/stylesheet/utils");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");

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

  onMarkupViewLoaded: function() {
    Trace.sysout("inspectorOverlay.onMarkupViewLoaded;");

    // xxxHonza: unload on destroy.
    let win = this.panel._markupFrame.contentWindow;
    loadSheet(win, "chrome://firequery/skin/firequery.css", "author");
  },
});

// Exports from this module
exports.InspectorOverlay = InspectorOverlay;
