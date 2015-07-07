/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

// Dependencies
const React = require("react");
const { Reps } = require("reps/reps");
const { ObjectLink } = require("reps/object-link");
const { ObjectBox } = require("reps/object-box");
const { Caption } = require("reps/caption");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @template TODO docs
 */
const Grip = React.createClass({
  displayName: "Grip",

  render: function() {
    var object = this.props.object;
    var props = this.shortPropIterator(object);

    //Trace.sysout("Grip.render; props: " + props.length, props);

    // xxxHonza: ObjectLink doesn't wrap the Array rep, why?
    return (
      ObjectBox({className: "object"},
        SPAN({className: "objectTitle"}, this.getTitle(object)),
        SPAN({className: "objectLeftBrace", role: "presentation"}, "("),
        props,
        SPAN({className: "objectRightBrace"}, ")")
      )
    )
  },

  getTitle: function() {
    return ""; //"Object";
  },

  longPropIterator: function (object) {
    try {
      return this.propIterator(object, 100);
    }
    catch (err) {
      Trace.sysout("ERROR " + err, err);
    }
  },

  shortPropIterator: function (object) {
    try {
      return this.propIterator(object, /*prefs["ObjectShortIteratorMax"]*/ 3);
    }
    catch (err) {
      Trace.sysout("ERROR " + err, err);
    }
  },

  propIterator: function(object, max) {
    // Property filter. Show only interesting properties to the user.
    function isInterestingProp(type, value) {
      return (
        type == "boolean" ||
        type == "number" ||
        type == "string" ||
        type == "object"
      );
    }

    // Object members with non-empty values are preferred since it gives the
    // user a better overview of the object.
    var props = [];
    this.getProps(props, object, max, isInterestingProp);

    if (props.length <= max) {
      // There are not enough props yet (or at least, not enough props to
      // be able to know whether we should print "more..." or not).
      // Let's display also empty members and functions.
      this.getProps(props, object, max, function(t, value) {
        return !isInterestingProp(t, value);
      });
    }

    // xxxHonza: localization
    if (props.length > max) {
      props.pop();
      props.push(Caption({
        key: "more",
        object: "more..."//Locale.$STR("reps.more"),
      }));
    }
    else if (props.length > 0) {
      // Remove the last comma.

      // NOTE: do not change comp._store.props directly to update a property,
      // it should be re-rendered or cloned with changed props
      props[props.length-1] = React.cloneElement(props[props.length-1], { delim: "" });
    }

    return props;
  },

  getProps: function (props, object, max, filter) {
    max = max || 3;
    if (!object) {
      return [];
    }

    var len = 0;

    try {
      // xxxHonza: we should include things from the prototype too
      var ownProperties = object.preview ? object.preview.ownProperties : [];
      for (var name in ownProperties) {
        if (props.length > max) {
          return;
        }

        var prop = ownProperties[name];
        var value = prop.value;

        // Type is specified in grip's "class" field and for primitive
        // values use typeof.
        var type = (value.class || typeof value);
        type = type.toLowerCase();

        // Show only interesting properties.
        if (filter(type, value)) {
          //let rep = Reps.getRep(value);
          //let tag = rep.tinyTag || rep.shortTag || rep.tag;
          if ((type == "object" || type == "function")) {
            //value = rep.getTitle(value);
            /*if (rep.titleTag) {
              tag = rep.titleTag;
            } else {
              tag = Reps.Obj.titleTag;
            }*/
          }

          props.push(PropRep({
            key: name,
            mode: "short",
            name: name,
            object: value,
            equal: ": ",
            delim: ", ",
            mode: this.props.mode,
            provider: this.props.provider
          }));
        }
      }
    }
    catch (err) {
      Trace.sysout("Grip.getProps; ERROR " + err, err);
    }
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
        SPAN({"className": "nodeName"}, this.props.name),
        SPAN({"className": "objectEqual", role: "presentation"}, this.props.equal),
        TAG({object: object, mode: mode, provider: provider}),
        SPAN({"className": "objectComma", role: "presentation"}, this.props.delim)
      )
    );
  }
}));

// Registration

function supportsObject(object, type) {
  if (!Reps.isGrip(object)) {
    return false;
  }

  return (object.preview && object.preview.ownProperties)
}

var GripFactory = React.createFactory(Grip);

Reps.registerRep({
  rep: GripFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.Grip = GripFactory;
});
