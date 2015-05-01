/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const options = require("@loader/options");
const { Cu, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { loadSheet, removeSheet } = require("sdk/stylesheet/utils");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");
const { ToolbarButton } = require("firebug.sdk/lib/toolbar-button.js");

// FireQuery
const { JQueryRenderer } = require("./jquery-renderer");
const { getJQuerifyCode } = require("./jquerify-code");

/**
 * @overlay This object represents an overlay for the existing
 * Console panel. It's responsible for Console customization.
 * The overlay follows the life cycle of the pane. It's created when
 * the panel is created (which happens when the panel is selected
 * by the user for the first time) and it's destroyed when the
 * Toolbox is destroyed.
 *
 * FireQuery is appending a new 'jQuerify' toolbar button
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

    let win = this.getPanelWindow();
    removeSheet(win, "chrome://firequery/skin/firequery.css", "author");
  },

  // Events

  onBuild: function(options) {
    PanelOverlay.prototype.onBuild.apply(this, arguments);

    Trace.sysout("ConsoleOverlay.onBuild;", options);

    let doc = this.getPanelDocument();
    let toolbar = doc.querySelector(".hud-console-filter-toolbar");
    let clearButton = doc.querySelector(".webconsole-clear-console-button");

    // Append jQuerify button into the Console panel toolbar. The button
    // is used to load latest jQuery into the current page.
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

    // Load custom style-sheet into the panel window (content window of
    // the panel's frame).
    let win = this.getPanelWindow();
    loadSheet(win, "chrome://firequery/skin/firequery.css", "author");
  },

  onReady: function(options) {
    PanelOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("ConsoleOverlay.onReady;", options);
  },

  // Commands

  onJQuerify: function() {
    // xxxHonza: webConsoleClient should be available at this point,
    // but would be a bit safer to call attachConsole.
    let webConsoleClient = getConsoleClient(this.panel);
    if (!webConsoleClient) {
      return;
    }

    // Evaluate jQuery script in the current page.
    let script = getJQuerifyCode();
    webConsoleClient.evaluateJSAsync(script, response => {
      if (response.error) {
        TraceError.sysout("ConsoleOverlay.onJQuerify; ERROR " +
          response.error, response);
      }
      else if (response.exception !== null) {
        TraceError.sysout("ConsoleOverlay.onJQuerify; EXCEPTION " +
          response.exception, response);
      }
      else {
        Trace.sysout("ConsoleOverlay.onJQuerify; DONE " +
          response.result, response);
      }
    });
  }
});

// Helpers

function getConsoleClient(panel) {
  return panel && panel.hud && panel.hud.ui ?
    panel.hud.ui.webConsoleClient : null;
}

// Exports from this module
exports.ConsoleOverlay = ConsoleOverlay;
