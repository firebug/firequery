/* See license.txt for terms of usage */

"use strict";

/**
 * This module is loaded on the backend (can be a remote device) where
 * some module or features (such as Tracing console) don't have to
 * be available.
 */

const { Cu } = require("chrome");

// Remote Debugging Protocol API
const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const protocol = devtools["require"]("devtools/server/protocol");
const { method, RetVal, ActorClass, Actor, Arg } = protocol;
const Events = require("sdk/event/core");
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");

const Previewers = DebuggerServer.ObjectActorPreviewers;

// For debugging purposes. Note that the tracing module isn't available
// on the backend (in case of remote device debugging).
 const baseUrl = "resource://firequery-at-binaryage-dot-com/";
 const { getTrace } = Cu.import(baseUrl + "node_modules/firebug.sdk/lib/core/actor.js");
 const Trace = getTrace();
//const Trace = {sysout: () => {}};

/**
 * Helper actor state watcher.
 */
function expectState(expectedState, method) {
  return function(...args) {
    if (this.state !== expectedState) {
      Trace.sysout("actor.expectState; ERROR wrong state, expected '" +
        expectedState + "', but current state is '" + this.state + "'" +
        ", method: " + method);

      let msg = "Wrong State: Expected '" + expectedState + "', but current " +
        "state is '" + this.state + "'";

      return Promise.reject(new Error(msg));
    }

    try {
      return method.apply(this, args);
    } catch (err) {
      Cu.reportError("actor.js; expectState EXCEPTION " + err, err);
    }
  };
}

/**
 * @actor This object represents an actor that is dynamically injected
 * (registered) to the debuggee target (back-end). The debuggee target
 * can be a running instance of the browser on local machine or remote
 * device such as mobile phone. The communication with this object is
 * always done through RDP (Remote Debugging Protocol). Read more about
 * {@link https://wiki.mozilla.org/Remote_Debugging_Protocol|RDP}.
 */
var FireQueryActor = ActorClass(
/** @lends FireQueryActor */
{
  typeName: "FireQueryActor",

  // Initialization

  initialize: function(conn, parent) {
    Trace.sysout("FireQueryActor.initialize; parent: " +
      parent.actorID + ", conn: " + conn.prefix, this);

    Actor.prototype.initialize.call(this, conn);

    this.parent = parent;
    this.state = "detached";
  },

  /**
   * The destroy is only called automatically by the framework (parent actor)
   * if an actor is instantiated by a parent actor.
   */
  destroy: function() {
    Trace.sysout("FireQueryActor.destroy; state: " + this.state, arguments);

    if (this.state === "attached") {
      this.detach();
    }

    Actor.prototype.destroy.call(this);
  },

  /**
   * Automatically executed by the framework when the parent connection
   * is closed.
   */
  disconnect: function() {
    Trace.sysout("FireQueryActor.disconnect; state: " + this.state, arguments);

    if (this.state === "attached") {
      this.detach();
    }
  },

  /**
   * Attach to this actor. Executed when the front (client) is attaching
   * to this actor.
   */
  attach: method(expectState("detached", function() {
    Trace.sysout("FireQueryActor.attach;", arguments);

    this.state = "attached";

    Previewers.Object.unshift(this.onPreview.bind(this));
  }), {
    request: {},
    response: {
      type: "attached"
    }
  }),

  onPreview: function(actor, grip, rawObj) {
    Trace.sysout("FireQueryActor.onPreview", arguments);

    if (actor.obj && actor.obj.proto) {
      var names = actor.obj.proto.getOwnPropertyNames();
      if (names.indexOf("jquery") >= 0) {
        Trace.sysout("!!! FireQueryActor.onPreview; jQuery object", actor);
      }
    }

    return false;
  },

  /**
   * Detach from this actor. Executed when the front (client) detaches
   * from this actor.
   */
  detach: method(expectState("attached", function() {
    Trace.sysout("FireQueryActor.detach;", arguments);

    this.state = "detached";

    // xxxHonza: remove previewer
  }), {
    request: {},
    response: {
      type: "detached"
    }
  }),
});

// Exports from this module
exports.FireQueryActor = FireQueryActor;
