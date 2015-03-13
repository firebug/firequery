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
const DevToolsUtils = devtools["require"]("devtools/toolkit/DevToolsUtils");

const Previewers = DebuggerServer.ObjectActorPreviewers;

// Number of items to preview in objects, arrays, maps, sets, lists,
// collections, etc.
const OBJECT_PREVIEW_MAX_ITEMS = 10;

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

    Previewers.Object.unshift(this.onBuildPreview.bind(this));
  }), {
    request: {},
    response: {
      type: "attached"
    }
  }),

  /**
   * Build jQuery object JSON preview that is sent back to the client.
   */
  onBuildPreview: makeInfallible(function(actor, grip, rawObj) {
    if (!DevToolsUtils.getProperty(actor.obj, "jquery")) {
      return false;
    }

    let length = DevToolsUtils.getProperty(actor.obj, "length");
    if (typeof length != "number") {
      return false;
    }

    let preview = grip.preview = {
      kind: "jQuery",
      length: length,
    };

    if (actor.threadActor._gripDepth > 1) {
      return true;
    }

    preview.items = [];

    let raw = actor.obj.unsafeDereference();
    for (let i = 0; i < preview.length; ++i) {
      // Array Xrays filter out various possibly-unsafe properties (like
      // functions, and claim that the value is undefined instead. This
      // is generally the right thing for privileged code accessing untrusted
      // objects, but quite confusing for Object previews. So we manually
      // override this protection by waiving Xrays on the array, and re-applying
      // Xrays on any indexed value props that we pull off of it.
      let desc = Object.getOwnPropertyDescriptor(Cu.waiveXrays(raw), i);
      if (desc && !desc.get && !desc.set) {
        let value = Cu.unwaiveXrays(desc.value);
        value = makeDebuggeeValueIfNeeded(actor.obj, value);

        let grip = actor.threadActor.createValueGrip(value);
        preview.items.push(grip);

        let cache = hasJQueryCache(desc.value);
        if (cache) {
          cache = Cu.unwaiveXrays(cache);
          cache = makeDebuggeeValueIfNeeded(actor.obj, cache);
          grip.preview.cache = actor.threadActor.createValueGrip(cache);

          // xxxHonza: generate preview for the cache?
        }
      } else {
        preview.items.push(null);
      }

      if (preview.length == OBJECT_PREVIEW_MAX_ITEMS) {
        break;
      }
    }

    Trace.sysout("FireQueryActor.onPreview; jQuery preview", preview);

    return true;
  }),

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

// Helpers

function makeDebuggeeValueIfNeeded(obj, value) {
  if (value && (typeof value == "object" || typeof value == "function")) {
    return obj.makeDebuggeeValue(value);
  }
  return value;
}

function evalJQueryCache(object) {
  try {
    var forceInternals = true;
    var win = object.ownerDocument.defaultView;
    var wrapper = win.wrappedJSObject || win;
    var jQuery = wrapper.jQuery;
    // jQuery 1.4 breaking changes (http://jquery14.com/day-01/jquery-14):
    // jQuery.data(elem) no longer returns an id, it returns the
    // element's object cache instead.
    var idOrCache = jQuery.data(object.wrappedJSObject || object,
      undefined, undefined, forceInternals);

    if (typeof idOrCache == "object") {
      // jQuery 1.4+ path
      return idOrCache;
    }

    // jQuery 1.3- path
    return jQuery.cache[idOrCache];
  } catch (ex) {
  }
};

function hasJQueryCache(object) {
  var cache = evalJQueryCache(object);
  for (var x in cache) {
    if (cache.hasOwnProperty(x)) {
      return cache;
    }
  }
};

// Exports from this module
exports.FireQueryActor = FireQueryActor;
