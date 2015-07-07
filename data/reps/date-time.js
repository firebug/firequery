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
var DateTime = React.createClass(
/** @lends DateTime */
{
  displayName: "Date",

  render: function() {
    var grip = this.props.object;
    return (
      ObjectLink({className: "Date"},
        SPAN({className: "objectTitle"}, this.getTitle(grip))
      )
    )
  },

  getTitle: function(grip) {
    return new Date(grip.preview.timestamp).toString();
  },
});

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return false;
  }

  return (type == "Date" && grip.preview);
}

var DateTimeFactory = React.createFactory(DateTime);

Reps.registerRep({
  rep: DateTimeFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.DateTime = DateTime;
});
