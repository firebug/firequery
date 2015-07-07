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
var CSSRule = React.createClass(
/** @lends CSSRule */
{
  displayName: "CSSRule",

  render: function() {
    var grip = this.props.object;
    return (
      ObjectLink({className: this.getType()},
        SPAN({className: "objectPropValue"},
          this.getDescription(grip)
        )
      )
    )
  },

  getType: function(grip) {
    return grip.class;
  },

  getDescription: function(grip) {
    return (grip.preview.kind == "ObjectWithText") ? grip.preview.text : "";
  },
});

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return false;
  }

  return (type == "CSSStyleRule" && grip.preview);
}

var CSSRuleFactory = React.createFactory(CSSRule);

Reps.registerRep({
  rep: CSSRuleFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.CSSRule = CSSRule;
});
