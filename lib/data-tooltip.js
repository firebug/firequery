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
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Content } = require("firebug.sdk/lib/core/content.js");

// Constants
const XHTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * This object implements a tooltip used in the MarkupView that
 * displays jQuery data (JSON) as an expandable tree.
 * Content of the tooltip is rendered using an iframe. Content
 * of the iframe is implemented by markup-tooltip.html
 */
function DataTooltip(options) {
  this.markup = options.markup;
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

    let dimensions = {
      width: "300",
      height: "21"
    };

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
    let data = JSON.stringify(this.jQueryData);
    this.postContentMessage("render", data);
  },

  onTooltipResize: function(size) {
    Trace.sysout("DataTooltip.onTooltipResize;", size);

    this.contentFrame.width = Math.min(size.width + 20, 500);
    this.contentFrame.height = Math.min(size.height, 400);
  },

  // Tooltip Content Communication

  onContentMessage: function(event) {
    Trace.sysout("DataTooltip.onContentMessage;", event);

    let { data } = event;
    switch (data.type) {
    case "ready":
      this.onTooltipReady(data.args);
      break;
    case "resize":
      this.onTooltipResize(data.args);
      break;
    }
  },

  /**
   * Send message to the content scope (panel's iframe)
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

    // load the document from url into the iframe
    iframe.setAttribute("src", url);

    // Put the iframe in the tooltip
    this.content = iframe;

    return def.promise;
  });
}

// Exports from this module
exports.DataTooltip = DataTooltip;
