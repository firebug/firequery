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
const { Url } = require("../core/url.js");

// Shortcuts
const { SPAN } = Reps.DOM;

/**
 * @rep Generic DOM element template.
 */
var Element = React.createClass(
/** @lends Element */
{
  displayName: "Element",

  render: function() {
    var grip = this.props.object;
    var mode = this.props.mode; 

    if (mode == "tiny") {
      return (
        ObjectLink({className: ""}, 
          SPAN({className: ""},
            SPAN({className: "selectorTag"},
              this.getSelectorTag(grip)
            ),
            SPAN({className: "selectorId"},
              this.getSelectorId(grip)
            ),
            SPAN({className: "selectorClass"},
              this.getSelectorClasses(grip)
            ),
            this.getValueTag(grip)
          )
        )
      )
    }

    var attrs = this.attrIterator(grip);
    return (
      ObjectLink({className: ""},
        "<",
        SPAN({className: "nodeTag"}, this.getLocalName(grip)),
        " ",
        attrs,
        ">"
       )
    )
  },

  // Template for <input> element with a single value coming from attribute.
  /*singleInputTag:
    SPAN(
      SPAN("&nbsp;"),
      SPAN({className: "selectorValue"},
        Locale.$STR("firebug.reps.element.attribute_value") + " = "
      ),
      SPAN({className: "attributeValue inputValue"},
        TAG(Reps.String.tag, {object: "$object|getValueFromAttribute"})
      )
    ),*/

  // Template for <input> element with two different values (attribute and property)
  /*multipleInputTag:
    SPAN(
      SPAN("&nbsp;"),
      SPAN({className: "selectorValue"},
        Locale.$STR("firebug.reps.element.property_value") + " = "
      ),
      SPAN({className: "propertyValue inputValue"},
        TAG(Reps.String.tag, {object: "$object|getValueFromProperty"})
      ),
      SPAN("&nbsp;"),
      SPAN({className: "selectorValue"},
        Locale.$STR("firebug.reps.element.attribute_value") + " = "
      ),
      SPAN({className: "attributeValue inputValue"},
        TAG(Reps.String.tag, {object: "$object|getValueFromAttribute"})
      )
    ),*/

  getValueTag: function(elt) {
    // Use proprietary template for <input> elements that can have two
    // different values. One coming from attribute 'value' and one coming
    // from property 'value'.

    //xxxHonza: FIX ME
    /*if (elt instanceof window.HTMLInputElement)
    {
        var attrValue = elt.getAttribute("value");
        var propValue = elt.value;

        if (attrValue != propValue)
            return this.multipleInputTag;
        else
            return this.singleInputTag;
    }*/

    // Generic template for various element values
    return SPAN({className: "selectorValue"}, this.getValue(elt));
  },

  getValueFromAttribute: function(elt) {
    var limit = Options.get("stringCropLength");
    var value = elt.getAttribute("value");
    return Str.cropString(value, limit);
  },

  getValueFromProperty: function(elt) {
    return Str.cropString(elt.value);
  },

  getValue: function(grip) {
    var preview = grip.preview;
    var value;

    if (grip.class == "HTMLImageElement") {
      value = Url.getFileName(preview.attributes["src"]);
    } else if (grip.class == "HTMLAnchorElement") {
      value = Url.getFileName(preview.attributes["href"]);
    } else if (grip.class == "HTMLInputElement") {
      value = preview.attributes["value"];
    } else if (grip.class == "HTMLFormElement") {
      value = Url.getFileName(preview.attributes["action"]);
    } else if (grip.class == "HTMLScriptElement") {
      value = Url.getFileName(preview.attributes["src"]);
    }

    return value ? " " + Str.cropMultipleLines(value, 20) : " ";
  },

  getLocalName: function(object) {
    return object.preview.nodeName;
  },

  getVisible: function(elt) {
    // xxxHonza: FIX ME
    // Use built-in support for determining element visibility.
    //return Xml.isVisible(elt) ? "" : "selectorHidden";
    return "";
  },

  getSelectorTag: function(elt) {
    return this.getLocalName(elt);
  },

  getSelectorId: function(grip) {
    var preview = grip.preview;
    try {
      var id = preview.attributes["id"];
      return id ? ("#" + id) : "";
    } catch (e) {
      return "";
    }
  },

  getSelectorClasses: function(grip) {
    var preview = grip.preview;
    if (!preview.classList) {
      return "";
    }

    // xxxHonza: we need the classList in the preview
    try {
      var selectorClasses = "";
      for (var i = 0, len = preview.classList.length; i < len; i++) {
        selectorClasses += "." + preview.classList[i];
      }
      return selectorClasses;
    } catch (err) {
      return "";
    }
  },

  attrIterator: function(grip) {
    var attrs = [];
    var idAttr, classAttr;
    if (grip.preview.attributes) {
      for (var name in grip.preview.attributes) {
        var attr = {
          localName: name,
          value: grip.preview.attributes[name]
        };

        if (name == "id") {
          idAttr = attr;
        } else if (name == "class") {
          classAttr = attr;
        } else {
          attrs.push(attr);
        }
      }
    }

    // Make sure 'id' and 'class' attributes are displayed first.
    if (classAttr) {
      attrs.splice(0, 0, classAttr);
    }

    if (idAttr) {
      attrs.splice(0, 0, idAttr);
    }

    return attrs.map(attr => AttrRep({object: attr}));
  },

  shortAttrIterator: function(grip) {
    // Short version returns only 'id' and 'class' attributes.
    var attrs = [];
    if (grip.preview.attributes) {
      for (var name in grip.preview.attributes) {
        var attr = {
          localName: name,
          value: grip.preview.attributes[name]
        };

        if (attr.localName == "id" || attr.localName == "class") {
          attrs.push(attr);
        }
      }
    }

    return attrs.map(attr => AttrRep(attr));
  },

  getHidden: function(elt) {
    // xxxHonza: FIX ME
    // Use built-in API to determine node visibility
    //return Xml.isVisible(elt) ? "" : "nodeHidden";
  },

  getTitle: function(grip, context) {
    return getElementCSSSelector(grip);
  },

  getTooltip: function(elt, context, target) {
    // xxxHonza: FIX ME

    /*
    // If the mouse cursor hovers over cropped value of an input element
    // display the full value in the tooltip.
    if (Css.hasClass(target, "objectBox-string"))
    {
        var inputValue = Dom.getAncestorByClass(target, "inputValue");
        if (inputValue)
        {
            var limit = Options.get("stringCropLength");
            var value;
            if (Css.hasClass(inputValue, "attributeValue"))
                value = elt.getAttribute("value");
            else if (Css.hasClass(inputValue, "propertyValue"))
                value = elt.value;

            if (value && value.length > limit)
                return value;
        }
    }*/

    return "";
  },
});

/**
 * A template for element attribute
 */
var AttrRep = React.createFactory(React.createClass(
/** @lends AttrRep */
{
  displayName: "AttrRep",

  render: function(){
    var grip = this.props.object;

    return (
      SPAN({},
        grip.localName + "=\"",
        SPAN({className: "nodeValue"}, this.getAttrValue(grip)),
        "\" "
      )
    );
  },

  getAttrValue: function(attr) {
    var limit = 1024;//prefs["displayedAttributeValueLimit"];
    return (limit > 0) ? Str.cropString(attr.value, limit) : attr.value;
  },
}));

// xxxHonza: should be shared lib API (was in css.js)
function getElementCSSSelector(grip) {
  var preview = grip.preview;
  if (!preview) {
    return;
  }

  var label = preview.nodeName;
  var id = preview.attributes["id"];
  if (id) {
    label += "#" + id;
  }

  // xxxHonza: we need to instrument the actor to send the class list
  // (or this might be supported natively)
  if (preview.classList) {
    for (var i = 0, len = preview.classList.length; i < len; i++) {
      label += "." + preview.classList[i];
    }
  }

  return label;
};

// Registration

function supportsObject(object, type) {
  if (!Reps.isGrip(object)) {
    return false;
  }

  if (!object.preview) {
    return false;
  }

  return /^HTML.*Element$/.test(type);
}

var ElementFactory = React.createFactory(Element);

Reps.registerRep({
  rep: ElementFactory,
  supportsObject: supportsObject
});

// Exports from this module
exports.Element = Element;
});
