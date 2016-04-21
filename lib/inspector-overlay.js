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
const { on, off, once } = require("sdk/event/core");
const { defer } = require("sdk/core/promise");

// Firebug SDK
const { devtools, safeRequire } = require("firebug.sdk/lib/core/devtools.js");

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
 * Inspector panel. The overlay is responsible for customization
 * of the panel.
 *
 * Every element that has jQuery.data associated has additional
 * icon rendered right next to it. Clicking on the icon opens
 * a tooltip displaying the data.
 *
 * It's also possible to right click on the icon and pick
 * 'Show DOM Properties' - it'll show jQuery.data in the
 * Variables View (Console's panel side panel). This built-in
 * action is usually used for elements.
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

    // Backend events
    this.onDataModified = this.onDataModified.bind(this);
  },

  destroy: function() {
    Trace.sysout("InspectorOverlay.destroy;", arguments);
  },

  // Overlay Events

  onBuild: function(options) {
    PanelOverlay.prototype.onBuild.apply(this, arguments);

    Trace.sysout("InspectorOverlay.onBuild;", options);

    // Load stylesheet into inspector.xul as well. There are
    // customization for Tooltip iframe (no transparent
    // padding for the tooltip arrow container).
    loadSheet(this.panel.panelWin,
      "chrome://firequery-os/skin/firequery.css",
      "author");

    // Handle MarkupView events.
    this.panel.on("markuploaded", this.onMarkupViewLoaded);
    this.panel.on("markupmutation", this.onMarkupMutation);
    this.panel.on("inspector-updated", this.onInspectorUpdated);
    this.panel.on("container-created", this.onMarkupViewContainerCreated)

    // Listen to data-modified events from the backend actor. These
    // events are used to update the indicator icon for elements
    // with jQuery.data
    this.getFrontWhenReady().then(front => {
      front.on("data-modified", this.onDataModified);
    });

    // Update the Inspector panel when 'attach' is fired. The event
    // might be already gone at this point, which is fine and in
    // that case the panel will be properly initialized since
    // the backend is already setup.
    // Otherwise, if the 'Inspector' panel is the default the backend
    // registration needs usually more time and happens when the
    // content is already there. In this case we need to refresh
    // panel content to make sure jQuery.data indicators (icons) are
    // also rendered.
    // xxxHonza: request better API (e.g. this.panel.refresh());
    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
    once(toolboxOverlay, "attach", () => {
      this.panel.onNewRoot();
    });

    // Monkey patch the InspectorPanel.
    // xxxHonza: what about extension uninstall/disable?
    this.showDOMPropertiesOriginal = this.panel.showDOMProperties;
    this.panel.showDOMProperties = this.showDOMProperties.bind(this);
  },

  onReady: function(options) {
    PanelOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("InspectorOverlay.onReady;", options);
  },

  // FireQueryFront

  getFrontWhenReady: function() {
    let deferred = defer();
    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);

    // The toolbox could have been destroyed immediately after open.
    if (!toolboxOverlay) {
      deferred.reject();
      return deferred.promise;
    }

    let front = toolboxOverlay.front;
    if (front) {
      deferred.resolve(front);
    } else {
      once(toolboxOverlay, "attach", (front) => {
        deferred.resolve(front);
      });
    }
    return deferred.promise;
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

    loadSheet(win, "chrome://firequery-os/skin/firequery.css", "author");
  },

  onMarkupViewUnloaded: function() {
    Trace.sysout("InspectorOverlay.onMarkupViewUnloaded;");
  },

  onInspectorUpdated: function(eventId, name) {
    Trace.sysout("InspectorOverlay.onInspectorUpdated; " + name, arguments);
  },

  onMarkupMutation: function(eventId) {
    Trace.sysout("InspectorOverlay.onMarkupMutation; ", arguments);
  },

  onMarkupViewContainerCreated: function(eventId, container) {
    //Trace.sysout("InspectorOverlay.onMarkupViewContainerCreated;");

    // Create a little data-icon indicating that the rendered element
    // has jQuery.data associated. Clicking on the icon opens a tooltip
    // with more details.
    let nodeFront = container.node;
    if (this.hasJQueryData(nodeFront)) {
      this.createDataIcon(container.elt);
    }
  },

  createDataIcon: function(element) {
    if (!element.classList.contains("editor")) {
      element = element.querySelector(".tag-line .editor");
    }

    // Bail out if the icon is already created.
    let icon = element.querySelector(".fireQueryData");
    if (icon) {
      return;
    }

    // Create a little icon indicating that the node (displayed in the
    // MarkupView) has jQuery.data associated. Clicking the icon
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
    if (!element.classList.contains("editor")) {
      element = element.querySelector(".tag-line .editor");
    }

    // Bail out if the icon doesn't exist.
    let icon = element.querySelector(".fireQueryData");
    if (icon) {
      icon.remove();
    }
  },

  onClickTooltip: function(event) {
    Trace.sysout("InspectorOverlay.onClickTooltip;", event);

    // If no node is selected, bail out.
    if (!this.panel.selection.isNode()) {
      return;
    }

    // Get node front for the clicked element.
    let nodeFront = this.panel.selection.nodeFront;
    this.getJQueryData(nodeFront).then(response => {
      // Create jQuery data tooltip object.
      let dataTooltip = new DataTooltip({
        context: this.context,
        toolbox: this.toolbox,
        panel: this.panel,
        target: event.target,
        jQueryData: response.jQueryData
      });

      // Show the tooltip
      dataTooltip.show();
    });
  },

  showDOMProperties: function() {
    let original = this.showDOMPropertiesOriginal;

    // The user needs to click on a little icon indicating
    // jQuery.data in the element in order to show properties
    // for the jQuery.data
    let target = this.panel.panelDoc.popupNode;
    if (!target.classList.contains("fireQueryData")) {
      return original.apply(this.panel, arguments);
    }

    // Make sure there are jQuery data associated with the node.
    let nodeFront = this.panel.selection.nodeFront;
    if (!this.hasJQueryData(nodeFront)) {
      return original.apply(this.panel, arguments);
    }

    // Alright, get jQuery.data from the backend and display
    // them in the VariablesView (Console panel's side panel).
    this.getJQueryData(nodeFront).then(response => {
      this.toolbox.openSplitConsole().then(() => {
        Trace.sysout("InspectorOverlay.showDOMProperties;", response);

        let panel = this.toolbox.getPanel("webconsole");
        let output = panel.hud.ui.output;

        // Retrieved 'response.jQueryData' is a grip object.
        output.openVariablesView({
          label: "jQuery.data",
          objectActor: response.jQueryData,
          //rawObject: raw e.g. JSON object, would go here,
          autofocus: true,
        });
      });
    });
  },

  // Backend Events

  onDataModified: function(response) {
    let markupView = this.panel.markup;
    if (!markupView) {
      return;
    }

    Trace.sysout("InspectorOverlay.onDataModified;", response);

    response.nodes.forEach(nodeData => {
      let nodeFront = nodeData;
      let hasJQueryData = this.hasJQueryData(nodeFront);

      //Trace.sysout("InspectorOverlay.onDataModified; " +
      //   nodeFront.nodeName + "#" + nodeFront.id +
      //   ", has data: " + hasJQueryData, nodeFront);

      // The container doesn't have to be always visible/available.
      let container = markupView.getContainer(nodeFront);
      if (!container) {
        //Trace.sysout("InspectorOverlay.onDataModified; no container, " +
        //  "has data: " + hasJQueryData);
        return;
      }

      // If jQuery data has been removed, remove also the little
      // indicator icon from the UI; otherwise make sure it's there!
      let element = container.elt;
      if (hasJQueryData) {
        this.createDataIcon(element);
      } else {
        this.removeDataIcon(element);
      }
    });
  },

  // Helpers for jQuery.data

  hasJQueryData: function(nodeFront) {
    let hasJQueryData;

    // nodeFront.getFormProperty has been introduced in Bug 1036949
    // xxxHonza: Checking existence of the method can be removed
    // as soon as Fx42 is the minimum required version.
    if (nodeFront.getFormProperty) {
      hasJQueryData = nodeFront.getFormProperty("hasJQueryData");
    } else if (nodeFront._form.props) {
      hasJQueryData = nodeFront._form.props.hasJQueryData;
    }

    return hasJQueryData;
  },

  getJQueryData: function(nodeFront) {
    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
    return toolboxOverlay.front.getJQueryData(nodeFront);
  }
});

// Exports from this module
exports.InspectorOverlay = InspectorOverlay;
