/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectLink } = require("reps/object-link");
const { Reps } = require("reps/reps");

const { Url } = require("../core/url.js");
const { Str } = require("../core/string.js");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep
 */
var Func = React.createClass(
/** @lends Func */
{
  displayName: "Func",

  render: function() {
    var grip = this.props.object;

    return (
      ObjectLink({className: "function"},
        this.summarizeFunction(grip)
      )
    )
  },

  summarizeFunction: function(grip) {
    // xxxHonza: display also arguments, but they are not in the preview.
    var name = grip.displayName || grip.name;
    return Str.cropString(grip.displayName + "()", 100);
  },

  getTooltip: function(fn, context) {
    var script = SourceFile.findScriptForFunctionInContext(context, fn);

    if (script) {
      return this.getTooltipForScript(script);
    }

    if (fn.toString) {
      return fn.toString();
    }
  },

  getTitle: function(fn, context) {
    var name = fn.name ? fn.name : "function";
    return name + "()";
  },
});

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return false;
  }

  return (type == "Function");
}

var FuncFactory = React.createFactory(Func);

Reps.registerRep({
  rep: FuncFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.Func = Func;
});
