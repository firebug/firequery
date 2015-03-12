/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const options = require("@loader/options");

const { Cu, Ci } = require("chrome");
const { on, off, emit } = require("sdk/event/core");
const { defer } = require("sdk/core/promise");
const { Class } = require("sdk/core/heritage");
const { loadSheet, removeSheet } = require("sdk/stylesheet/utils");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");
const { ToolbarButton } = require("firebug.sdk/lib/toolbar-button.js");
const { Rdp } = require("firebug.sdk/lib/core/rdp.js");

// FireQuery
const { FireQueryFront } = require("./firequery-front.js");
const { JQueryRenderer } = require("./jquery-renderer");

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");

// URL of the {@FireQueryActor} module. This module will be
// installed and loaded on the backend.
const actorModuleUrl = options.prefixURI + "lib/firequery-actor.js";

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

    this.onNewMessages = this.onNewMessages.bind(this);
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

    let win = this.getPanelWindow();
    loadSheet(win, "chrome://firequery/skin/firequery.css", "author");

    this.attach();
  },

  onReady: function(options) {
    PanelOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("ConsoleOverlay.onReady;", options);

    // Add listeners to {@WebConsoleFrame} object to hook message logging.
    let hud = this.panel.hud;
    hud.ui.on("new-messages", this.onNewMessages);
  },

  // Backend

  attach: makeInfallible(function() {
    Trace.sysout("ConsoleOverlay.attach;");

    let config = {
      prefix: FireQueryFront.prototype.typeName,
      actorClass: "FireQueryActor",
      frontClass: FireQueryFront,
      moduleUrl: actorModuleUrl
    };

    let deferred = defer();
    let client = this.toolbox.target.client;

    // Register as tab actor.
    Rdp.registerTabActor(client, config).then(({registrar, front}) => {
      FBTrace.sysout("ConsoleOverlay.attach; READY", front);

      this.front = front;

      // xxxHonza: Unregister at shutdown
      this.registrar = registrar;

      emit(this, "attached", front);
      deferred.resolve(front);
    });

    return deferred.promise;
  }),

  detach: function() {
    Trace.sysout("ConsoleOverlay.detach;");

    // xxxHonza: TODO
  },

  // Message Logging Hooks

  onNewMessages: function(topic, messages) {
    messages.forEach(msg => {
      this.onNewLog(msg);
    });
  },

  onNewLog: function(log) {
    Trace.sysout("ConsoleOverlay.onNewLog;", log);

    let node = log.node;
    let msg = log.response;

    let args = msg.arguments;
    if (!args) {
      return;
    }

    // xxxHonza: remove the tracing
    FBTrace.sysout("!!! args " + args.length, args);
  },

  // Commands

  onJQuerify: function() {
  }
});

// Exports from this module
exports.ConsoleOverlay = ConsoleOverlay;
