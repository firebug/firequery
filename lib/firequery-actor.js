/* See license.txt for terms of usage */

"use strict";

/**
 * This module is loaded on the backend (can be a remote device) where
 * some module or features (such as Tracing console) don't have to
 * be available. Also Firebug SDK isn't available on the backend.
 */

// Add-on SDK
const { Cu, components } = require("chrome");

// DevTools
const { DebuggerServer } = Cu.import("resource://gre/modules/devtools/dbg-server.jsm", {});
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const protocol = devtools["require"]("devtools/server/protocol");
const { method, RetVal, ActorClass, Actor, Arg, types } = protocol;
const Events = devtools["require"]("sdk/event/core");
const { makeInfallible } = devtools["require"]("devtools/toolkit/DevToolsUtils.js");
const DevToolsUtils = devtools["require"]("devtools/toolkit/DevToolsUtils");
const { NodeActor } = devtools["require"]("devtools/server/actors/inspector");

// Constants
const Previewers = DebuggerServer.ObjectActorPreviewers;

// Number of items to preview in objects, arrays, maps, sets, lists,
// collections, etc.
const OBJECT_PREVIEW_MAX_ITEMS = 10;

// For debugging purposes. Note that the tracing module isn't available
// on the backend (in case of remote device debugging).
// const baseUrl = "resource://firequery-at-binaryage-dot-com/";
// const { getTrace } = Cu.import(baseUrl + "node_modules/firebug.sdk/lib/core/actor.js");
// const Trace = getTrace(DebuggerServer.parentMessageManager);
const Trace = {sysout: () => {}};

/**
 * Helper actor state watcher.
 * expectState has been introduced in Fx42
 * TODO: const { expectState } = require("devtools/server/actors/common");
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
 *
 * Read more about Protocol API:
 * https://github.com/mozilla/gecko-dev/blob/master/toolkit/devtools/server/docs/protocol.js.md
 */
var FireQueryActor = ActorClass(
/** @lends FireQueryActor */
{
  typeName: "FireQueryActor",

  /**
   * Events emitted by this actor.
   */
  events: {
    "data-modified": {
      type: "dataModified",
      node: Arg(0, "disconnectedNode"),
      jQueryData: Arg(1, "nullable:json")
    }
  },

  // Initialization

  initialize: function(conn, parent) {
    Trace.sysout("FireQueryActor.initialize; parent: " +
      parent.actorID + ", conn: " + conn.prefix, this);

    Actor.prototype.initialize.call(this, conn);

    this.parent = parent;
    this.state = "detached";

    // DevTools events
    this.onNodeActorForm = this.onNodeActorForm.bind(this);
    this.onNavigate = this.onNavigate.bind(this);

    // jQuery events
    this.onDataModified = this.onDataModified.bind(this);
    this.onJQueryDetected = this.onJQueryDetected.bind(this);

    // Console customization
    this.onBuildPreview = this.onBuildPreview.bind(this);
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

    Previewers.Object.unshift(this.onBuildPreview);

    Events.on(this.parent, "navigate", this.onNavigate);
    Events.on(NodeActor, "form", this.onNodeActorForm);
  }), {
    request: {},
    response: {
      type: "attached"
    }
  }),

  /**
   * Detach from this actor. Executed when the front (client) detaches
   * from this actor.
   */
  detach: method(expectState("attached", function() {
    Trace.sysout("FireQueryActor.detach;", arguments);

    this.state = "detached";

    Events.off(this.parent, "navigate", this.onNavigate);
    Events.off(NodeActor, "form", this.onNodeActorForm);

    // Remove (content) window listeners.
    if (this.patch) {
      let win = this.parent.window.wrappedJSObject;
      win.removeEventListener("jQueryDetected", this.onJQueryDetected, true);
      win.removeEventListener("firequery-event", this.onDataModified, true);
    }

    // Remove previewer listener (web console).
    removeItem(Previewers.Object, this.onBuildPreview);
  }), {
    request: {},
    response: {
      type: "detached"
    }
  }),

  /**
   * Build jQuery object JSON preview that is sent back to the client.
   * This method is used by the Console panel when displaying jQuery
   * collection of elements.
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

    // Introduced in Fx42
    let hooks = actor.hooks;
    if (hooks && hooks.getGripDepth() > 1) {
      return true;
    }

    let threadActor = this.parent.threadActor;
    if (threadActor && threadActor._gripDepth > 1) {
      return true;
    }

    Trace.sysout("FireQueryActor.onBuildPreview;", arguments);

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

        let grip = this.createValueGrip(actor, value);
        preview.items.push(grip);

        let data = hasJQueryData(desc.value);
        if (data) {
          data = Cu.unwaiveXrays(data);
          data = makeDebuggeeValueIfNeeded(actor.obj, data);
          grip.preview.jQueryData = this.createValueGrip(actor, data);

          // xxxHonza: generate preview for the data?
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

  createValueGrip: function(actor, value) {
    // Introduced in Fx42
    if (actor.hooks) {
      return actor.hooks.createValueGrip(value);
    }

    return actor.threadActor.createValueGrip(value);
  },

  /**
   * Set UI stylesheet for anonymous content (sent from the client).
   */
  patchJQuery: method(expectState("attached", function(patch, watcher,
    walkerActorID, consoleActorID) {

    Trace.sysout("FireQueryActor.patchJQuery;", arguments);

    // Remember arguments, so we can re-patch when the page is navigated.
    this.patch = patch || this.patch;
    this.watcher = watcher || this.watcher;
    this.walkerActorID = walkerActorID || this.walkerActorID;
    this.consoleActorID = consoleActorID || this.consoleActorID;

    let win = this.parent.window.wrappedJSObject;
    win.addEventListener("jQueryDetected", this.onJQueryDetected, true);
    win.addEventListener("firequery-event", this.onDataModified, true);
    win.eval(this.watcher);
  }), {
    request: {
      patch: Arg(0, "string"),
      watcher: Arg(1, "string"),
      walker: Arg(2, "string"),
      walker: Arg(3, "string")
    },
    response: {
      type: "jquery-patched"
    }
  }),

  onJQueryDetected: makeInfallible(function(event) {
    let win = this.parent.window.wrappedJSObject;

    Trace.sysout("FireQueryActor.onJQueryDetected; " + win.location, event);

    win.eval(this.patch);
  }),

  onDataModified: makeInfallible(function(event) {
    let win = this.parent.window.wrappedJSObject;

    Trace.sysout("FireQueryActor.onDataModified; " + win.location, event);

    if (ignoreEventParsers()) {
      return;
    }

    let walkerActor = this.conn.getActor(this.walkerActorID);
    if (!walkerActor) {
      return;
    }

    let data = walkerActor.attachElement(event.target);
    let jQueryData = hasJQueryData(event.target);

    Trace.sysout("FireQueryActor.onDataModified;", {
      data: data,
      jQueryData: jQueryData
    });

    try {
      // xxxHonza: circular data can't be stringified FIX ME.
      let json = jQueryData ? JSON.stringify(jQueryData) : "";
      Events.emit(this, "data-modified", data, json);
    } catch(err) {
      Trace.sysout("FireQueryActor.onDataModified; ERROR " + err, err);
    }
  }),

  /**
   * Returns jQuery data for given node.
   */
  getJQueryData: method(expectState("attached", function(node) {
    Trace.sysout("FireQueryActor.getJQueryData;", node);

    let consoleActor = this.conn.getActor(this.consoleActorID);
    let data = hasJQueryData(node.rawNode);
    data = Cu.unwaiveXrays(data);
    data = makeDebuggeeValueIfNeeded(consoleActor, data);
    let grip = consoleActor.createValueGrip(data);

    Trace.sysout("FireQueryActor.getJQueryData; data", {
      grip: grip,
      jQueryData: data
    });

    return {
      jQueryData: grip
    }
  }), {
    request: { node: Arg(0, "domnode") },
    response: RetVal("json"),
  }),

  // Events

  /**
   * Page navigation handler.
   */
  onNavigate: function({isTopLevel}) {
    Trace.sysout("FireQueryActor.onNavigate " + isTopLevel);

    if (isTopLevel) {
      this.patchJQuery();
    }
  },

  // Debugger Server Events

  onNodeActorForm: makeInfallible(function(event) {
    let nodeActor = event.target;
    let form = event.data;
    let data = hasJQueryData(nodeActor.rawNode);

    // xxxHonza: check that the event comes from an actor in the
    // same connection as this actor.

    // Pass only a flag that says whether there are any jQuery
    // data associated or not. The data itself will be fetched
    // on demand (when displayed e.g. in a tooltip)
    form.setFormProperty("hasJQueryData", !!data);
  })
});

// Helpers

function makeDebuggeeValueIfNeeded(obj, value) {
  if (value && (typeof value == "object" || typeof value == "function")) {
    return obj.makeDebuggeeValue(value);
  }
  return value;
}

function evalJQueryData(object) {
  try {
    var forceInternals = true;
    var win = object.ownerDocument.defaultView;
    var wrapper = win.wrappedJSObject || win;
    var jQuery = wrapper.jQuery;
    // jQuery 1.4 breaking changes (http://jquery14.com/day-01/jquery-14):
    // jQuery.data(elem) no longer returns an id, it returns the
    // element's object data instead.
    var data = jQuery.originalDataReplacedByFireQuery || jQuery.data;
    var idOrData = data(object.wrappedJSObject || object,
      undefined, undefined, forceInternals);

    if (typeof idOrData == "object") {
      // jQuery 1.4+ path
      return idOrData;
    }

    // jQuery 1.3- path
    return jQuery.cache[idOrData];
  } catch (ex) {
  }
};

function hasJQueryData(object) {
  var data = evalJQueryData(object);
  for (var x in data) {
    if (data.hasOwnProperty(x)) {
      return data;
    }
  }
};

// Patching NodeActor (add custom info into actor form)
// Bug 1036949 - New API: MarkupView customization
// xxxHonza: Can be removed as soon as Fx42 is the
// minimum required version.
let originalForm = NodeActor.prototype.form;
NodeActor.prototype.form = function(detail) {
  let form = originalForm.apply(this, arguments);

  // The return value doesn't always have to be a form object.
  if (detail === "actorid") {
    return form;
  }

  // form.setFormProperty has been introduced in Bug 1036949
  // The content of the following if block is taken from the
  // patch attached to Bug 1036949
  if (!form.setFormProperty) {
    // Add an extra API for custom properties added by other
    // modules/extensions.
    form.setFormProperty = (name, value) => {
      if (!form.props) {
        form.props = {};
      }
      form.props[name] = value;
    };

    // Fire an event so, other modules can create its own properties
    // that should be passed to the client (within the form.props field).
    Events.emit(NodeActor, "form", {
      target: this,
      data: form
    });
  }

  return form;
}

// Helpers

/**
 * Remove an item from specified array. Copied from Firebug.sdk
 * (since the SDK isn't available on the backend).
 */
function removeItem(list, item) {
  for (let i = 0; i < list.length; i++) {
    if (list[i] == item) {
      list.splice(i, 1);
      return true;
    }
  }
  return false;
};

/**
 * EventParser module in DevTools is internally executing jQuery.data
 * function. Ignore these calls.
 */
function ignoreEventParsers() {
  var eventParser = "resource://gre/modules/devtools/event-parsers.js";
  var counter = 0;
  var stack = components.stack;
  while (stack && counter++ < 10) {
    var url = stack.filename;
    if (url && url.indexOf(eventParser) != -1) {
      return true;
    }
    stack = stack.caller;
  }
  return false;
}

// Exports from this module
exports.FireQueryActor = FireQueryActor;
