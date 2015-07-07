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

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { MarkupView } = devtools["require"]("devtools/markupview/markup-view");

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
 * icon rendered right next to it. Clicking on the icon opens
 * a tooltip displaying the data.
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
    this.onMarkupViewLoaded = this.onMarkupViewLoaded.bind(this);
    this.onMarkupViewUnloaded = this.onMarkupViewUnloaded.bind(this);
    this.onMarkupMutation = this.onMarkupMutation.bind(this);
    this.onInspectorUpdated = this.onInspectorUpdated.bind(this);
    this.onMarkupViewContainerCreated = this.onMarkupViewContainerCreated.bind(this);

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
    this.panel.on("markuploaded", this.onMarkupViewLoaded);
    this.panel.on("markupmutation", this.onMarkupMutation);
    this.panel.on("inspector-updated", this.onInspectorUpdated);
    this.panel.on("container-created", this.onMarkupViewContainerCreated)

    // Listen to {@FireQueryToolboxOverlay} events related to
    // backend actor attach and detach.
    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
    on(toolboxOverlay, "attach", this.onAttach);
    on(toolboxOverlay, "detach", this.onDetach);

    // Monkey patch the InspectorPanel.
    // xxxHonza: what about extension uninstall/disable?
    this.showDOMPropertiesOriginal = this.panel.showDOMProperties;
    this.panel.showDOMProperties = this.showDOMProperties.bind(this);
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
    //loadSheet(win, "chrome://firebug.sdk/skin/domTree.css", "author");

    // xxxHonza: The inspector panel doesn't render jQuery data directly
    // anymore. It's only displaying a little icon (an envelope) that
    // indicates presence of data. The user can see details in a tooltip
    // after clicking the icon.
    return;

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

  onInspectorUpdated: function(eventId, name) {
    Trace.sysout("InspectorOverlay.onInspectorUpdated; " + name, arguments);
  },

  onMarkupMutation: function(eventId) {
    Trace.sysout("InspectorOverlay.onMarkupMutation; ", arguments);
  },

  onMarkupViewContainerCreated: function(eventId, container) {
    Trace.sysout("InspectorOverlay.onMarkupViewContainerCreated; ", arguments);

    let nodeFront = container.node;
    let hasJQueryData = false;

    // nodeFront.getFormProperty has been introduced in Bug 1036949
    // xxxHonza: Checking existence of the method can be removed
    // as soon as Fx42 is the minimum required version.
    if (nodeFront.getFormProperty) {
      hasJQueryData = nodeFront.getFormProperty("hasJQueryData");
    } else if (nodeFront._form.props) {
      hasJQueryData = nodeFront._form.props.hasJQueryData;
    }

    if (!hasJQueryData) {
      return;
    }

    this.createDataIcon(container.elt);
  },

  createDataIcon: function(element) {
    Trace.sysout("InspectorOverlay.createDataIcon; ", element);

    let icon = element.querySelector(".fireQueryData");
    if (icon) {
      return;
    }

    if (!element.classList.contains("editor")) {
      element = element.querySelector(".tag-line .editor");
    }

    // Create a little icon indicating the the node (displayed in the
    // Markup View) has jQuery data associated. Clicking the icon
    // displays the data as an expandable tree in a tooltip.
    let doc = element.ownerDocument;
    icon = doc.createElementNS(XHTML_NS, "span");
    icon.className = "fireQueryData";
    icon.innerHTML = "&#9993;";
    icon.addEventListener("click", this.onClickTooltip, true);
    element.appendChild(icon);

    return icon;
  },

  removeDataIcon: function(element) {
    Trace.sysout("InspectorOverlay.removeDataIcon;", element);

    let icon = element.querySelector(".fireQueryData");
    if (!icon) {
      return;
    }

    icon.remove();
  },

  onClickTooltip: function(event) {
    Trace.sysout("InspectorOverlay.onClickTooltip;", event);

    // If no node is selected, bail out.
    if (!this.panel.selection.isNode()) {
      return;
    }

    // Get node front for the clicked element.
    let nodeFront = this.panel.selection.nodeFront;

    // Use jQuery actor front to get fresh jQuery data
    // for the clicked node (for the selection).
    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
    if (!toolboxOverlay) {
      TraceError.sysout("InspectorOverlay.onClickTooltip; ERROR no " +
        "toolbox overlay!", this.context);
      return;
    }

    toolboxOverlay.front.getJQueryData(nodeFront).then(response => {
      // Create jQuery data tooltip object.
      let dataTooltip = new DataTooltip({
        toolbox: this.toolbox,
        markup: this.panel.markup,
        target: event.target,
        jQueryData: response.jQueryData
      });

      // Show the tooltip
      dataTooltip.show();
    });
  },

  showDOMProperties: function() {
    Trace.sysout("InspectorOverlay.showDOMProperties;", this.panel);

    let original = this.showDOMPropertiesOriginal;

    // The user needs to click on the jQueryData element (an envelope)
    let target = this.panel.panelDoc.popupNode;
    if (!target.classList.contains("fireQueryData")) {
      return original.apply(this.panel, arguments);
    }

    // There must be jQuery data associated with the node.
    let nodeFront = this.panel.selection.nodeFront;
    let jQueryData = nodeFront._form.jQueryData;
    if (!jQueryData) {
      return original.apply(this.panel, arguments);
    }

    // Display clicked jQuery data instead of element properties.
    this.toolbox.openSplitConsole().then(() => {
      let panel = this.toolbox.getPanel("webconsole");
      let output = panel.hud.ui.output;

      output.openVariablesView({
        label: "jQuery.data",
        //objectActor: dataGrip,
        rawObject: jQueryData,
        autofocus: true,
      });
    });
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
    if (!markupView) {
      Trace.sysout("InspectorOverlay.onDataModified; ERROR No Markup view",
        arguments);
    }

    let client = this.toolbox.target.client;

    let nodeFront = nodeData.node;
    let container = markupView.getContainer(nodeFront);
    if (!container) {
      Trace.sysout("InspectorOverlay.onDataModified; No Container", nodeData);
      return;
    }

    let element = container.elt;

    // If jQuery data has been removed, remove also the little
    // envelop icon from the UI; otherwise make sure it's there.
    if (typeof jQueryData == "undefined") {
      this.removeDataIcon(element);
    } else {
      this.createDataIcon(element);
    }

    /*let nodes = [{
      element: container.elt,
      jQueryData: jQueryData
    }];*/

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

// Patching MarkupView (fire a new "container-created" event)
// Bug 1036949 - New API: MarkupView customization
// xxxHonza: Can be removed as soon as Fx42 is the
// minimum required version.
let originalImportNode = MarkupView.prototype.importNode;
MarkupView.prototype.importNode = function(aNode, aFlashNode) {
  if (!aNode) {
    return null;
  }

  if (this._containers.has(aNode)) {
    return this.getContainer(aNode);
  }

  let container = originalImportNode.apply(this, arguments);

  // Feature detection based on nodeFront.getFormProperty() API
  let nodeFront = container.node;
  if (!nodeFront.getFormProperty) {
    this._inspector.emit("container-created", container);
  }

  return container;
}
// Exports from this module
exports.InspectorOverlay = InspectorOverlay;
