/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectLink } = require("reps/object-link");
const { Reps } = require("reps/reps");
const { Caption } = require("reps/caption");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep
 */
var NamedNodeMap = React.createClass(
/** @lends NamedNodeMap */
{
  className: "NamedNodeMap",

  render: function() {
    var grip = this.props.object;
    var mode = this.props.mode;
    var max = (mode == "short") ? 3 : 100;

    var items = grip.preview.ownProperties ? this.propIterator(grip, max) :
      grip.ownPropertyLength;

    return (
      ObjectLink({className: "NamedNodeMap"},
        SPAN({className: "arrayLeftBracket", role: "presentation"}, "["),
        items,
        SPAN({className: "arrayRightBracket", role: "presentation"}, "]")
      )
    )
  },

  propIterator: function (grip, max) {
    max = max || 3;

    var props = [];

    var provider = this.props.provider;
    if (!provider) {
      return props;
    }

    for (var i=0; i<grip.ownProperties.length && i<max; i++) {
      var item = grip.ownProperties(i);
      var name = provider.getLabel(item);
      var value = provider.getValue(item);

      props.push({
        name: name,
        object: value,
        equal: ": ",
        delim: ", "
      });
    }

    if (object.length > max) {
      var index = max - 1, more = object.length - max + 1;
      if (index < 1) {
        index = 1;
        more++;
      }

      props[index] = {
        object: more + " " + Locale.$STR("firebug.reps.more") + "...",
        tag: Caption.tag,
        name: "",
        equal: "",
        delim: ""
      };
    }
    else if (props.length > 0) {
      props[props.length-1].delim = "";
    }

    return props;
  },
});

/**
 * Property for a grip object.
 */
var PropRep = React.createFactory(React.createClass(
/** @lends PropRep */
{
  displayName: "PropRep",

  render: function(){
    var object = this.props.object;
    var mode = this.props.mode;
    var provider = this.props.provider;

    var TAG = Reps.getRep(object);
    return (
      SPAN({},
        SPAN({className: "nodeName"}, "$prop.name"),
        SPAN({className: "objectEqual", role: "presentation"}, this.props.equal),
        TAG("$prop.tag", {object: object, provider: provider, mode: mode}),
        SPAN({className: "objectComma", role: "presentation"}, this.props.delim)
      )
    )
  }
}));

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return false;
  }

  return (type == "NamedNodeMap" && grip.preview);
}

var NamedNodeMapFactory = React.createFactory(NamedNodeMap);

Reps.registerRep({
  rep: NamedNodeMapFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.NamedNodeMap = NamedNodeMap;
});
