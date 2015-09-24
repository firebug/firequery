/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const options = require("@loader/options");
const { Cu, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");
const { defer, resolve } = require("sdk/core/promise");
const { on, off, emit } = require("sdk/event/core");

// DevTools
const { devtools, makeInfallible } = require("firebug.sdk/lib/core/devtools.js");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Locale } = require("firebug.sdk/lib/core/locale.js");
const { ToolboxOverlay } = require("firebug.sdk/lib/toolbox-overlay.js");
const { Rdp } = require("firebug.sdk/lib/core/rdp.js");
const { Http } = require("firebug.sdk/lib/core/http.js");

// FireQuery
const { FireQueryFront } = require("./firequery-front");
const { getJQueryWatcherCode } = require("./jquery-watcher-code");

// URL of the {@FireQueryActor} module. This module will be
// installed and loaded on the backend.
const actorModuleUrl = options.prefixURI + "lib/firequery-actor.js";

const JQUERYPATCH = "chrome://firequery-resources/content/jquery2-patch.js";

/**
 * @overlay This object represents an overlay for the Toolbox. The
 * overlay is created when the Toolbox is opened and destroyed when
 * the Toolbox is closed. There is one instance of the overlay per
 * Toolbox, and so there can be more overlay instances created per
 * one browser session.
 *
 * FireQuery uses the overlay to register and attach/detach the
 * backend actor.
 *
 * The rest of the extension can access actor's front object
 * as follows:
 *
 * let toolboxOverlay = this.context.getOverlay(ToolboxOverlayId);
 * let front = toolboxOverlay.front;
 */
const FireQueryToolboxOverlay = Class(
/** @lends FireQueryToolboxOverlay */
{
  extends: ToolboxOverlay,

  overlayId: "FireQueryToolboxOverlay",

  // Initialization

  initialize: function(options) {
    ToolboxOverlay.prototype.initialize.apply(this, arguments);

    Trace.sysout("FireQueryToolboxOverlay.initialize;", options);
  },

  destroy: function() {
    ToolboxOverlay.prototype.destroy.apply(this, arguments);

    Trace.sysout("FireQueryToolboxOverlay.destroy;", arguments);

    this.detach();
  },

  // Events

  onReady: function(options) {
    ToolboxOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("FireQueryToolboxOverlay.onReady;", options);

    this.attach();
  },

  // Backend

  /**
   * Attach to the backend FireQuery actor.
   */
  attach: makeInfallible(function() {
    Trace.sysout("FireQueryToolboxOverlay.attach;");

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
      Trace.sysout("FireQueryToolboxOverlay.attach; READY", this);

      // xxxHonza: Unregister at shutdown
      this.registrar = registrar;
      this.front = front;

      // Patch jQuery on the backend and resolve when it's done.
      // xxxHonza: This should be done as part of the 'attach' packet.
      this.patchJQuery().then(() => {
        emit(this, "attach", front);
        this.deferredAttach.resolve(front);
      });
    });

    return this.deferredAttach.promise;
  }),

  detach: makeInfallible(function() {
    Trace.sysout("FireQueryToolboxOverlay.detach;");

    // xxxHonza: TODO clean up?

    // Emit an event indicating that the detach process is done. This
    // can be used e.g. by tests.
    emit(this, "detach");
  }),

  patchJQuery: function() {
    let deferred = defer();

    let patch = Http.getResource(JQUERYPATCH);
    let watcher = getJQueryWatcherCode();

    // xxxHonza: activeConsole object has been introduced in Fx40
    // It should be used instead of the tedious asynchronous
    // process as soon as Fx40 is the minimum required version.
    // We still need to call initInspector to get the walker though.
    // let console = this.toolbox.target.activeConsole;
    let target = this.toolbox.target;
    target.activeTab.attachThread({}, (response, thread) => {
      if (thread.paused) {
        thread.resume();
      }

      this.attachConsole(thread).then(console => {
        this.toolbox.initInspector().then(() => {
          let walker = this.toolbox.walker;
          this.front.patchJQuery(patch, watcher, walker, console).then(() => {
            deferred.resolve();
          });
        });
      });
    });

    return deferred.promise;
  },

  attachConsole: function(threadClient) {
    let deferred = defer();
    let debuggerClient = threadClient.client;
    let consoleActor = this.toolbox.target.form.consoleActor;

    debuggerClient.attachConsole(consoleActor, ["ConsoleAPI"],
      (response, webConsoleClient) => {

      if (response.error) {
        deferred.reject(response);
      } else {
        deferred.resolve(webConsoleClient);
      }
    });

    return deferred.promise;
  },

  getJQueryFront: function() {
    return this.attach();
  },
});

// Exports from this module
exports.FireQueryToolboxOverlay = FireQueryToolboxOverlay;
