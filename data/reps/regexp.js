/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectLink } = require("reps/object-link");
const { Reps } = require("reps/reps");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep
 */
var RegExp = React.createClass(
/** @lends RegExp */
{
  displayName: "regexp",

  render: function() {
    var grip = this.props.object;
    return (
      ObjectLink({className: "regexp"},
        SPAN({className: "objectTitle"}, this.getTitle(grip)),
        SPAN(" "),
        SPAN({className: "regexpSource"}, this.getSource(grip))
      )
    )
  },

  getTitle: function(grip) {
    return grip.class;
  },

  getSource: function(grip) {
    return grip.displayString;
  }
});

// Registration

function supportsObject(object, type) {
  if (!Reps.isGrip(object)) {
    return false;
  }

  return (type == "RegExp");
}

var RegExpFactory = React.createFactory(RegExp);

Reps.registerRep({
  rep: RegExpFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.RegExp = RegExp;
});
