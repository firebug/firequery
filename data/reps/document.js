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
 * @rep
 */
var Document = React.createClass(
/** @lends Document */
{
  displayName: "Document",

  render: function() {
    var grip = this.props.object;

    return (
      ObjectBox({className: "object"},
        SPAN({className: "objectPropValue"},
          this.getLocation(grip)
        )
      )
    )
  },

  getLocation: function(grip) {
    var location = grip.preview.location;
    return location ? Url.getFileName(location) : "";
  },

  getTitle: function(win, context) {
    return "document";
  },

  getTooltip: function(doc) {
    return doc.location.href;
  }
});

// Registration

function supportsObject(object, type) {
  if (!Reps.isGrip(object)) {
    return false;
  }

  return (object.preview && type == "HTMLDocument");
}

var DocumentFactory = React.createFactory(Document);

Reps.registerRep({
  rep: DocumentFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.Document = Document;
});
