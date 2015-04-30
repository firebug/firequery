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
const { on, off } = require("sdk/event/core");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");
const { Dom } = require("firebug.sdk/lib/core/dom.js");
const { Content } = require("firebug.sdk/lib/core/content.js");

// FireQuery
const { FireQueryToolboxOverlay } = require("./firequery-toolbox-overlay.js");
const { DataTooltip } = require("./data-tooltip.js");

// Constants
const XHTML_NS = "http://www.w3.org/1999/xhtml";
const ToolboxOverlayId = FireQueryToolboxOverlay.prototype.overlayId;

/**
 * @overlay This object represents an overlay for the existing
 * Inspector panel which is responsible for customization.
 *
 * Every element that has jQuery.data associated has additional
 * info rendered right next to it.
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

    // MarkupView events
    this.onMarkupViewRender = this.onMarkupViewRender.bind(this);
    this.onMarkupViewLoaded = this.onMarkupViewLoaded.bind(this);
    this.onMarkupViewUnloaded = this.onMarkupViewUnloaded.bind(this);

    // Tooltip events
    this.onClickTooltip = this.onClickTooltip.bind(this);

    // Handler for messages from MarkupView content.
    this.onContentMessage = this.onContentMessage.bind(this);

    // FireQueryToolboxOverlay events
    this.onAttach = this.onAttach.bind(this);
    this.onDetach = this.onDetach.bind(this);

    // Backend events
    this.onDataModified = this.onDataModified.bind(this);

    this.nodes = [];
  },

  destroy: function() {
    Trace.sysout("InspectorOverlay.destroy;", arguments);

    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
    off(toolboxOverlay, "attach", this.onAttach);
    off(toolboxOverlay, "detach", this.onDetach);
  },

  // Overlay Events

  onBuild: function(options) {
    PanelOverlay.prototype.onBuild.apply(this, arguments);

    Trace.sysout("InspectorOverlay.onBuild;", options);

    // Handle MarkupView events.
    this.panel.on("markupview-render", this.onMarkupViewRender);
    this.panel.on("markuploaded", this.onMarkupViewLoaded);

    // Listen to {@FireQueryToolboxOverlay} events related to
    // backend actor attach and detach.
    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
    on(toolboxOverlay, "attach", this.onAttach);
    on(toolboxOverlay, "detach", this.onDetach);
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
    Trace.sysout("InspectorOverlay.onMarkupViewLoaded;");

    let frame = this.panel._markupFrame;
    let win = frame.contentWindow;
    let doc = win.document;

    frame.addEventListener("unload", this.onMarkupViewUnloaded, true);

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

    let ContentTrace = {
      sysout: () => FBTrace.sysout.apply(FBTrace, arguments)
    }

    // Expose tracing into the MarkupView content.
    Content.exportIntoContentScope(win, ContentTrace, "Trace");
  },

  onMarkupViewUnloaded: function() {
    Trace.sysout("InspectorOverlay.onMarkupViewUnloaded;");

    this.markupScriptReady = false;
    this.nodes = [];
  },

  onMarkupViewRender: function(eventId, node, type, data, options) {
    this.renderNode(node, type, data);
  },

  renderNode: function(node, type, data) {
    if (type != "element") {
      return;
    }

    let value;
    let nodeFront = data.node;
    let jQueryData = nodeFront._form.jQueryData;

    if (!jQueryData) {
      return;
    }

    Trace.sysout("InspectorOverlay.onMarkupViewRender; " +
      this.markupScriptReady, jQueryData);

    // Create wrapper for data rendered as soon as markup view
    // content scripts are loaded (see: onMarkupScriptReady)
    let doc = node.ownerDocument;
    let label = doc.createElementNS(XHTML_NS, "span");
    label.className = "fireQueryData";
    label.innerHTML = "&#9993;";
    label.addEventListener("click", this.onClickTooltip, true);
    label.jQueryData = jQueryData;
    node.appendChild(label);

    let item = {
      element: node,
      jQueryData: jQueryData
    };

    // Render now if MarkupView content script is already loaded.
    // Otherwise push it into an array and render as soon as
    // the content is properly initialized.
    /*if (this.markupScriptReady) {
      this.postContentMessage("render", [item]);
    } else {
      this.nodes.push(item);
    }*/
  },

  onClickTooltip: function(event) {
    let dataTooltip = new DataTooltip({
      markup: this.panel.markup,
      target: event.target,
    });

    dataTooltip.show();
  },

  onMarkupScriptReady: function() {
    Trace.sysout("InspectorOverlay.onMarkupScriptReady; " +
      this.nodes.length, this.nodes);

    this.markupScriptReady = true;

    if (this.nodes.length) {
      this.postContentMessage("render", this.nodes);
    }
  },

  // ToolboxOverlay Events

  onAttach: function(front) {
    Trace.sysout("InspectorOverlay.onAttach;", arguments);

    front.on("data-modified", this.onDataModified);

    // Update the markup view
    // xxxHonza: request better API (e.g. this.panel.refresh());
    this.panel.onNewRoot();
  },

  onDetach: function() {
    Trace.sysout("InspectorOverlay.onDetach;", arguments);
  },

  // Backend Events

  onDataModified: function(nodeData, jQueryData) {
    Trace.sysout("InspectorOverlay.onDataModified;", arguments);

    let markupView = this.panel.markup;
    let client = this.toolbox.target.client;

    let nodeFront = nodeData.node;
    let container = markupView.getContainer(nodeFront);
    if (!container) {
      return;
    }

    let nodes = [{
      element: container.elt,
      jQueryData: jQueryData
    }];

    // Re-render nodes within the MarkupView frame.
    //this.postContentMessage("render", nodes);
  },

  // Communication: content <-> chrome

  onContentMessage: function(event) {
    Trace.sysout("InspectorOverlay.onContentMessage; ", event);

    let { data } = event;
    switch (data.type) {
    case "ready":
      this.onMarkupScriptReady();
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
});

// Helpers

// Exports from this module
exports.InspectorOverlay = InspectorOverlay;
