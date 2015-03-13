/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const options = require("@loader/options");
const { Cu, Ci } = require("chrome");
const { on, off, emit } = require("sdk/event/core");
const { defer, resolve } = require("sdk/core/promise");
const { Class } = require("sdk/core/heritage");
const { loadSheet, removeSheet } = require("sdk/stylesheet/utils");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");
const { ToolbarButton } = require("firebug.sdk/lib/toolbar-button.js");
const { Rdp } = require("firebug.sdk/lib/core/rdp.js");

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");

// FireQuery
const { FireQueryFront } = require("./firequery-front");
const { JQueryRenderer } = require("./jquery-renderer");
const { getJQuerifyCode } = require("./jquerify-code");

// URL of the {@FireQueryActor} module. This module will be
// installed and loaded on the backend.
const actorModuleUrl = options.prefixURI + "lib/firequery-actor.js";

/**
 * @overlay This object represents an overlay for the existing
 * Console panel and is responsible for Console customization.
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

    this.detach();
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

    let win = this.getPanelWindow();
    loadSheet(win, "chrome://firequery/skin/firequery.css", "author");

    this.attach();
  },

  onReady: function(options) {
    PanelOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("ConsoleOverlay.onReady;", options);
  },

  // Backend

  /**
   * Attach to the backend FireQuery actor.
   */
  attach: makeInfallible(function() {
    Trace.sysout("ConsoleOverlay.attach;");

    if (this.deferredAttach) {
      return this.deferredAttach.promise;
    }

    let config = {
      prefix: FireQueryFront.prototype.typeName,
      actorClass: "FireQueryActor",
      frontClass: FireQueryFront,
      moduleUrl: actorModuleUrl
    };

    this.deferredAttach = defer();
    let client = this.toolbox.target.client;

    // Register as tab actor.
    Rdp.registerTabActor(client, config).then(({registrar, front}) => {
      FBTrace.sysout("ConsoleOverlay.attach; READY", front);

      this.front = front;

      // xxxHonza: Unregister at shutdown
      this.registrar = registrar;

      // Emit an event indicating that the attach process is done. This
      // can be used e.g. by tests.
      emit(this, "attached", front);

      // Resolve the 'attach promise'.
      this.deferredAttach.resolve(front);
    });

    return this.deferredAttach.promise;
  }),

  detach: function() {
    Trace.sysout("ConsoleOverlay.detach;");

    // xxxHonza: TODO
  },

  getJQueryFront: function() {
    return this.attach();
  },

  // Commands

  onJQuerify: function() {
    // xxxHonza: webConsoleClient should be available at this point,
    // but safer would be to call attachConsole.
    let webConsoleClient = getConsoleClient(this.panel);
    if (!webConsoleClient) {
      return;
    }

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
