/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectLink } = require("reps/object-link");
const { Reps } = require("reps/reps");

/**
 * @rep
 */
var Event = React.createClass(
/** @lends Event */
{
  displayName: "event",

  render: function() {
    var grip = this.props.object;
    return (
      ObjectLink({className: "event"},
        this.summarizeEvent(grip)
      )
    )
  },

  summarizeEvent: function(grip) {
    var info = [grip.preview.type, " "];

    var eventFamily = grip.class;
    var props = grip.preview.properties;

    if (eventFamily == "MouseEvent") {
      info.push("clientX=", props.clientX, ", clientY=", props.clientY);
    } else if (eventFamily == "KeyboardEvent") {
      info.push("charCode=", props.charCode, ", keyCode=", props.keyCode);
    } else if (eventFamily == "MessageEvent") {
      info.push("origin=", props.origin, ", data=", props.data);
    }

    return info.join("");
  },
});

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return false;
  }

  return (grip.preview && grip.preview.kind == "DOMEvent");
}

var EventFactory = React.createFactory(Event);

Reps.registerRep({
  rep: EventFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.Event = Event;
});
