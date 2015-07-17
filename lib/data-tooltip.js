/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const self = require("sdk/self");
const { Cu, Ci } = require("chrome");

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { Widgets } = devtools.require("devtools/webconsole/console-output");
const { VariablesView } = Cu.import("resource:///modules/devtools/VariablesView.jsm", {});
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");
const { Tooltip } = devtools["require"]("devtools/shared/widgets/Tooltip");
const { Promise: promise } = Cu.import("resource://gre/modules/Promise.jsm", {});

// Platform
const { Services } = Cu.import("resource://gre/modules/Services.jsm", {});

// Firebug SDK
const { Trace, TraceError, FBTrace } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Content } = require("firebug.sdk/lib/core/content.js");
const { Locale } = require("firebug.sdk/lib/core/locale.js");

// FireQuery
const { FireQueryToolboxOverlay } = require("./firequery-toolbox-overlay.js");

// Constants
const XHTML_NS = "http://www.w3.org/1999/xhtml";
const ToolboxOverlayId = FireQueryToolboxOverlay.prototype.overlayId;

/**
 * This object implements a tooltip used in the MarkupView (Inspector panel)
 * that displays jQuery data as an expandable tree. Content of the tooltip
 * is rendered using an iframe. Content of the iframe is implemented
 * in markup-tooltip.html
 *
 * markup-tooltip.html uses require.js and react.js to render its content.
 * Communication between the iframe content and this object is done
 * through events (win.dispatchEvent).
 */
function DataTooltip(options) {
  this.context = options.context;
  this.toolbox = options.toolbox;
  this.panel = options.panel;
  this.markup = options.panel.markup;
  this.target = options.target;
  this.tooltip = this.markup.tooltip;
  this.jQueryData = options.jQueryData;

  this.onContentMessage = this.onContentMessage.bind(this);
  this.onTooltipLoaded = this.onTooltipLoaded.bind(this);
}

DataTooltip.prototype =
/** @lends DataTooltip */
{
  show: makeInfallible(function() {
    this.tooltip.hide(this.target);

    // Initial size of the tooltip. It's changed as the content
    // requires it (e.g. when the user is expanding tree-nodes
    // and more space is required).
    let dimensions = {
      width: "300",
      height: "21"
    };

    // Load the content!
    let frameUrl = self.data.url("./markup-tooltip.html");
    this.tooltip.setIFrameContent(dimensions, frameUrl).
      then(this.onTooltipLoaded);

    this.markup._makeTooltipPersistent(true);
    this.tooltip.once("hidden", () => {
      this.markup._makeTooltipPersistent(false);
    });

    this.tooltip.show(this.target);
  }),

  // Tooltip Event Handlers

  onTooltipLoaded: function(frame) {
    this.contentFrame = frame;
    this.contentWin = frame.contentWindow;
    this.contentWin.addEventListener("firequery/content/message",
      this.onContentMessage, true);
  },

  onTooltipReady: function() {
    let win = this.contentWin;

    // The tracing options for tooltip-content (the code within
    // the iframe) is available as: FIREQUERY/DATA-TOOLTIP
    let { Trace: contentTrace } = FBTrace.get("DATA-TOOLTIP");

    Content.exportIntoContentScope(win, contentTrace, "Trace");
    Content.exportIntoContentScope(win, Locale, "Locale");

    // We need the thread object to get client object for grips
    // (using threadClient.pauseGrip).
    let target = this.toolbox.target;
    target.activeTab.attachThread({}, (response, threadClient) => {
      this.threadClient = threadClient;

      // The tooltip is opened for given jQuery data.
      let data = JSON.stringify(this.jQueryData);
      this.postContentMessage("initialize", data);

      // Do not forget to resume the debugger.
      if (threadClient.paused) {
        threadClient.resume();
      }
    });
  },

  /**
   * Update size of the tooltip when the content requests that.
   */
  onTooltipResize: function(size) {
    Trace.sysout("DataTooltip.onTooltipResize;", size);

    if (this.resizeTimeout) {
      this.contentWin.clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    this.resizeTimeout = this.contentWin.setTimeout(() => {
      this.contentFrame.width = Math.min(size.width + 20, 500);
      this.contentFrame.height = Math.min(size.height, 400);

      this.resizeTimeout = null;
    }, 50);
  },

  onGetPrototypeAndProperties: function(grip) {
    let client = this.threadClient.pauseGrip(grip);
    client.getPrototypeAndProperties(response => {
      this.postContentMessage("prototypeAndProperties",
        JSON.stringify(response));
    });
  },

  /**
   * Support for UI navigation. If the user clicks on an element
   * value inside the tooltip, the element is selected within the
   * Markup View (Inspector panel).
   */
  onNavigate: function(grip) {
    // First, get nodeFront object from give grip. Our FQ actor
    // implements helper method for that.
    let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
    toolboxOverlay.front.getNode(grip.actor).then(node => {
      Trace.sysout("DataTooltip.onNavigate; getNode: ", node);

      // Show the node in the UI and make sure it's selected.
      this.panel.selection.setNodeFront(node, "selectorsearch");
    });
  },

  // Tooltip Content Communication

  /**
   * Handle events coming from the tooltip iframe (content).
   */
  onContentMessage: function(event) {
    //Trace.sysout("DataTooltip.onContentMessage;", event);

    let { data } = event;
    switch (data.type) {
    case "ready":
      this.onTooltipReady(data.args);
      break;
    case "resize":
      this.onTooltipResize(data.args);
      break;
    case "getPrototypeAndProperties":
      this.onGetPrototypeAndProperties(data.args);
      break;
    case "navigate":
      this.onNavigate(data.args);
      break;
    }
  },

  /**
   * Send message to the content scope (tooltip's iframe)
   */
  postContentMessage: function(type, args) {
    let win = this.contentWin;

    var data = {
      type: type,
      args: args,
    };

    data = Content.cloneIntoContentScope(win, data);

    var event = new win.MessageEvent("firequery/chrome/message", {
      bubbles: true,
      cancelable: true,
      data: data,
    });

    win.dispatchEvent(event);
  },
}

// Patch Tooltip
// The Tooltip widget has been introduced in Fx40
// https://bugzilla.mozilla.org/show_bug.cgi?id=980006
if (!Tooltip.prototype.setIFrameContent) {
  Tooltip.prototype.setIFrameContent = makeInfallible(function({width, height}, url) {
    let def = promise.defer();

    // Create an iframe
    let iframe = this.doc.createElementNS(XHTML_NS, "iframe");
    iframe.setAttribute("transparent", true);
    iframe.setAttribute("width", width);
    iframe.setAttribute("height", height);
    iframe.setAttribute("flex", "1");
    iframe.setAttribute("class", "devtools-tooltip-iframe");

    // Wait for the load to initialize the widget
    function onLoad() {
      iframe.removeEventListener("load", onLoad, true);
      def.resolve(iframe);
    }
    iframe.addEventListener("load", onLoad, true);

    // Load the document from url into the iframe
    iframe.setAttribute("src", url);

    // Put the iframe in the tooltip
    this.content = iframe;

    return def.promise;
  });
}

// Exports from this module
exports.DataTooltip = DataTooltip;
