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
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Locale } = require("firebug.sdk/lib/core/locale.js");
const { ToolboxOverlay } = require("firebug.sdk/lib/toolbox-overlay.js");
const { Rdp } = require("firebug.sdk/lib/core/rdp.js");
const { Http } = require("firebug.sdk/lib/core/http.js");

// FireQuery
const { FireQueryFront } = require("./firequery-front");
const { getJQueryWatcherCode } = require("./jquery-watcher-code");
const { InspectorOverlay } = require("./inspector-overlay.js");

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

    this.onDataModified = this.onDataModified.bind(this);
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

      this.front = front;

      on(this.front, "dataModified", this.onDataModified);

      // xxxHonza: Unregister at shutdown
      this.registrar = registrar;

      // Patch jQuery on the backend
      // xxxHonza: wait till it's done and fire "attached".
      this.patchJQuery();

      // Emit an event indicating that the attach process is done. This
      // can be used e.g. by tests.
      emit(this, "attached", front);

      // Resolve the 'attach promise'.
      this.deferredAttach.resolve(front);
    });

    return this.deferredAttach.promise;
  }),

  patchJQuery: function() {
    let patch = Http.getResource(JQUERYPATCH);
    let watcher = getJQueryWatcherCode();

    this.toolbox.initInspector().then(() => {
      let walker = this.toolbox.walker;
      this.front.patchJQuery(patch, watcher, walker.actorID);
    });
  },

  detach: makeInfallible(function() {
    Trace.sysout("FireQueryToolboxOverlay.detach;");

    // xxxHonza: TODO

    // Emit an event indicating that the detach process is done. This
    // can be used e.g. by tests.
    emit(this, "detached");
  }),

  getJQueryFront: function() {
    return this.attach();
  },

  // Front Events

  onDataModified: function(nodeFront) {
    Trace.sysout("FireQueryToolboxOverlay.onDataModified; " +
      nodeFront.actor, nodeFront);

    let overlayId = InspectorOverlay.prototype.overlayId;
    let inspectorOverlay = this.context.getOverlay(overlayId);
    let markupView = inspectorOverlay.panel.markup;
    let container = markupView.getContainer(nodeFront);

    let nodes = [{
      element: container.elt,
      cache: nodeFront._form.jQueryCacheData
    }];

    // Re-render nodes within the MarkupView frame.
    inspectorOverlay.postContentMessage("render", nodes);
  }
});

// Exports from this module
exports.FireQueryToolboxOverlay = FireQueryToolboxOverlay;
