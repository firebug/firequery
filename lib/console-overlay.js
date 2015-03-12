/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const options = require("@loader/options");

const { Cu, Ci } = require("chrome");
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Class } = require("sdk/core/heritage");
const { PanelOverlay } = require("firebug.sdk/lib/panel-overlay.js");
const { ToolbarButton } = require("firebug.sdk/lib/toolbar-button.js");
const { on, off, emit } = require("sdk/event/core");
const { defer } = require("sdk/core/promise");

const { FireQueryFront } = require("./firequery-front.js");
const { Rdp } = require("firebug.sdk/lib/core/rdp.js");

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");

// URL of the {@FireQueryActor} module. This module will be
// installed and loaded on the backend.
const actorModuleUrl = options.prefixURI + "lib/firequery-actor.js";

/**
 * @overlay This object represents an overlay for the existing
 * Console panel and is responsible for Console customization.
 * FireQuery is hooking console logging and changing the way
 * how jQuery object is rendered in the Console.
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

  /**
   * Attach to the backend FireQuery actor.
   */
  attach: makeInfallible(function() {
    FBTrace.sysout("ConsoleOverlay.attach;");

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

      // Emit an event indicating that the attach process is done. This
      // can be used e.g. by tests.
      emit(this, "attached", front);
      deferred.resolve(front);
    });

    return deferred.promise;
  }),

  detach: function() {
    // xxxHonza: TODO
  },

  // Message Logging Hooks

  onNewMessages: function(topic, messages) {
    messages.forEach(msg => {
      this.onNewLog(msg);
    });
  },

  onNewLog: function(log) {
    let node = log.node;
    let msg = log.response;
    let args = msg.arguments;

    for (let i=0; i<args.length; i++) {
      let arg = args[i];
      if (arg.preview.jquery) {
        FBTrace.sysout("ConsoleOverlay.onNewLog; jQuery object", arg);
      }
    }
  },

  // Commands

  onJQuerify: function() {
  }
});

// Exports from this module
exports.ConsoleOverlay = ConsoleOverlay;
