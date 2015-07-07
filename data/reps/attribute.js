/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectLink } = require("reps/object-link");
const { Reps } = require("reps/reps");
const { StringRep } = require("reps/string");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep
 */
var Attribute = React.createClass(
/** @lends Attribute */
{
  displayName: "Attr",

  render: function() {
    var grip = this.props.object;
    var value = grip.preview.value;

    return (
      ObjectLink({className: "Attr"},
        SPAN({},
          SPAN({className: "attrTitle"},
            this.getTitle(grip)
          ),
          SPAN({className: "attrEqual"},
            "="
          ),
          StringRep({object: value})
        )
      )
    )
  },

  getTitle: function(grip) {
    return grip.preview.nodeName;
  },
});

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return false;
  }

  return (type == "Attr" && grip.preview);
}

var AttributeFactory = React.createFactory(Attribute);

Reps.registerRep({
  rep: AttributeFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.Attribute = Attribute;
});
