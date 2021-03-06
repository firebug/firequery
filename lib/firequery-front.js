/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const { Cu } = require("chrome");
const Events = require("sdk/event/core");

// DevTools
const DevTools = require("firebug.sdk/lib/core/devtools.js");
const { Front, FrontClass, custom } = DevTools.Protocol;

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);

// FireQuery
const { FireQueryActor } = require("./firequery-actor.js");

/**
 * @front This object represents client side for the backend FireQuery
 * actor.
 *
 * Read more about Protocol API:
 * https://github.com/mozilla/gecko-dev/blob/master/toolkit/devtools/server/docs/protocol.js.md
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

  patchJQuery: custom(function(patch, watcher, walker, console) {
    this.walker = walker;
    return this._patchJQuery(patch, watcher, walker.actorID, console.actor);
  }, {
    impl: "_patchJQuery"
  }),

  ensureParentFront: function(...args) {
    return this.walker.ensureParentFront.apply(this.walker, args);
  },

  getNode: custom(function(actorId) {
    return this._getNode(actorId).then(response => {
      return response.node;
    });
  }, {
    impl: "_getNode"
  }),
});

// Exports from this module
exports.FireQueryFront = FireQueryFront;
