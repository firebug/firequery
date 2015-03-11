/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const { Cu, Ci } = require("chrome");
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Class } = require("sdk/core/heritage");
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");
const { ToolbarButton } = require("firebug.sdk/lib/toolbar-button.js");

/**
 * @overlay This object represents an overlay for the existing
 * Console panel. This object is responsible for the panel customization.
 */
const ConsoleOverlay = Class(
/** @lends ConsoleOverlay */
{
  extends: PanelOverlay,

  overlayId: "fireQueryConsoleOverlay",
  panelId: "webconsole",

  // Initialization

  initialize: function(options) {
    PanelOverlay.prototype.initialize.apply(this, arguments);

    Trace.sysout("ConsoleOverlay.initialize;", options);
  },

  destroy: function() {
    Trace.sysout("ConsoleOverlay.destroy;", arguments);
  },

  // Events

  onBuild: function(options) {
    PanelOverlay.prototype.onBuild.apply(this, arguments);

    Trace.sysout("ConsoleOverlay.onBuild;", options);

    let doc = this.getPanelDocument();
    let toolbar = doc.querySelector(".hud-console-filter-toolbar");
    let clearButton = doc.querySelector(".webconsole-clear-console-button");

    // Append a button into the Console panel toolbar.
    let button = new ToolbarButton({
      id: "firequery-jquerify",
      className: "devtools-toolbarbutton",
      toolbar: toolbar,
      _tabindex: parseInt(clearButton.getAttribute("tabindex") + 1, 10),
      referenceElement: clearButton.nextSibling,
      label: "firequery.jQuerify.label",
      tooltiptext: "firequery.jQuerify.tip",
      command: this.onJQuerify.bind(this)
    });
  },

  onReady: function(options) {
    PanelOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("ConsoleOverlay.onReady;", options);
  },

  // Commands

  onJQuerify: function() {
  }
});

// Exports from this module
exports.ConsoleOverlay = ConsoleOverlay;
