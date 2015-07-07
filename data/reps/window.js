/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectBox } = require("reps/object-box");
const { Reps } = require("reps/reps");

// FireQuery
const { Str } = require("../core/string.js");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep
 */
var Window = React.createClass(
/** @lends Window */
{
  displayName: "Window",

  render: function() {
    var grip = this.props.object;

    return (
      ObjectBox({className: "Window"},
        SPAN({className: "objectPropValue"},
          this.getLocation(grip)
        )
      )
    )
  },

  getLocation: function(grip) {
    var location = grip.preview.url;
    return Str.cropString(grip.preview.url);
  },

  getTitle: function(grip, context) {
    return grip.class;
  },

  getTooltip: function(grip) {
    return grip.preview.url;
  }
});

// Registration

function supportsObject(object, type) {
  if (!Reps.isGrip(object)) {
    return false;
  }

  return (object.preview && type == "Window");
}

var WindowFactory = React.createFactory(Window);

Reps.registerRep({
  rep: WindowFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.Window = Window;
});
