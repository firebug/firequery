/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const { Cc, Ci, Cu } = require("chrome");
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { FireQueryActor } = require("./firequery-actor.js");
const Events = require("sdk/event/core");

const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { Front, FrontClass } = devtools["require"]("devtools/server/protocol");
const { custom } = devtools["require"]("devtools/server/protocol");

/**
 * @front This object represents client side for the backend FireQuery
 * actor.
 */
var FireQueryFront = FrontClass(FireQueryActor,
/** @lends FireQueryFront */
{
  // Initialization

  initialize: function(client, form) {
    Front.prototype.initialize.apply(this, arguments);

    Trace.sysout("FireQueryFront.initialize;", this);

    this.actorID = form[FireQueryActor.prototype.typeName];
    this.manage(this);
  },

  patchJQuery: custom(function(patch, watcher, walker) {
    this.walker = walker;
    return this._patchJQuery(patch, watcher, walker.actorID);
  }, {impl: "_patchJQuery"}),

  ensureParentFront: function(...args) {
    this.walker.ensureParentFront.apply(this.walker, args);
  },

  onAttached: function(response) {
    Trace.sysout("FireQueryFront.onAttached;", response);
  },

  onDetached: function(response) {
    Trace.sysout("FireQueryFront.onDetached;", response);
  },
});

// Exports from this module
exports.FireQueryFront = FireQueryFront;
