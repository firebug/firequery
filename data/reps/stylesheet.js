/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectBox } = require("reps/object-box");
const { Reps } = require("reps/reps");

// FireQuery
const { Url } = require("../core/url");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep xxxHonza: should be derived from object-with-url template
 */
var StyleSheet = React.createClass(
/** @lends StyleSheet */
{
  displayName: "object",

  render: function() {
    var grip = this.props.object;

    return (
      ObjectBox({className: "object"},
        "StyleSheet ",
        SPAN({className: "objectPropValue"},
          this.getLocation(grip)
        )
      )
    )
  },

  getLocation: function(grip) {
    // Embedded stylesheets don't have URL and so, no preview.
    var url = grip.preview ? grip.preview.url : "";
    return url ? Url.getFileName(url) : "";
  },
});

// Registration

function supportsObject(object, type) {
  if (!Reps.isGrip(object)) {
    return false;
  }

  return (type == "CSSStyleSheet");
}

var StyleSheetFactory = React.createFactory(StyleSheet);

Reps.registerRep({
  rep: StyleSheetFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.StyleSheet = StyleSheet;
});
