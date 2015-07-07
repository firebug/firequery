/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// ReactJS
const React = require("react");

// Firebug.SDK
const { ObjectBox } = require("reps/object-box");
const { Reps } = require("reps/reps");
const { ArrayComponent } = require("reps/array");

// FireQuery
const { Url } = require("../core/url");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep
 */
var ArrayRep = React.createClass(Reps.extend(ArrayComponent,
/** @lends ArrayRep */
{
  displayName: "ArrayRep",

  getLength: function(grip) {
    return grip.preview ? grip.preview.length : 0;
  },

  arrayIterator: function(grip, max) {
    var items = [];

    if (!grip.preview || !grip.preview.length) {
      return items;
    }

    var array = grip.preview.items;
    if (!array) {
      return items;
    }

    var provider = this.props.provider;
    if (!provider) {
      return items;
    }

    for (var i=0; i<array.length && i<=max; i++) {
      try {
        var delim = (i == array.length-1 ? "" : ", ");
        var value = provider.getValue(array[i]);

        // Cycle detected
        //if (value === array) {
        //  value = new ReferenceObj(value);
        //}

        items.push({
          key: i,
          object: value,
          delim: delim,
          provider: this.props.provider
        });
      }
      catch (exc) {
        items.push({object: exc, delim: delim, key: i});
      }
    }

    return items;
  },

  hasSpecialProperties: function(array) {
    return false;
  },
}));

// Registration

function supportsObject(grip, type) {
  if (!Reps.isGrip(grip)) {
    return;
  }

  return (grip.preview && grip.preview.kind == "ArrayLike");
}

var ArrayRepFactory = React.createFactory(ArrayRep);

Reps.registerRep({
  rep: ArrayRepFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.ArrayRep = ArrayRep;
});
