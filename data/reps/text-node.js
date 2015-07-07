/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectLink } = require("reps/object-link");
const { Reps } = require("reps/reps");

// FireQuery
const { Str } = require("../core/string.js");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep
 */
var TextNode = React.createClass(
/** @lends TextNode */
{
  displayName: "textNode",

  render: function() {
    var grip = this.props.object;
    var mode = this.props.mode || "short";

    if (mode == "short" || mode == "tiny") {
      return (
        ObjectLink({className: "textNode"},
          "\"" + this.getTextContent(grip) + "\""
        )
      )
    }

    return (
      ObjectLink({className: "textNode"},
        "<",
        SPAN({"class": "nodeTag"}, "TextNode"),
        " textContent=\"",
        SPAN({className: "nodeValue"},
          this.getTextContent(grip)
        ),
        "\"",
        ">;"
      )
    )
  },

  getTextContent: function(grip) {
    return Str.cropMultipleLines(grip.preview.textContent);
  },

  getTitle: function(win, context) {
    return "textNode";
  }
});

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return false;
  }

  return (grip.preview && grip.class == "Text");
}

var TextNodeFactory = React.createFactory(TextNode);

Reps.registerRep({
  rep: TextNodeFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.TextNode = TextNode;
});
