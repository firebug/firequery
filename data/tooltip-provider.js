/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Implementation
function TooltipProvider(store) {
  this.store = store;
}

/**
 * This object provides data for the tree displayed in the tooltip
 * content.
 */
TooltipProvider.prototype =
/** @lends TooltipProvider */
{
  /**
   * Fetches properties from the backend. These properties might be
   * displayed as child objects in e.g. a tree UI widget.
   */
  getChildren: function(object) {
    var value = this.getValue(object);
    Trace.sysout("TooltipProvider.getChildren; for: " +
      value.actor, object);

    var grip = object;

    if (object instanceof Property) {
      grip = this.getValue(object);
    }

    if (!grip || !grip.actor) {
      Trace.sysout("TooltipProvider.getChildren; ERROR invalid grip!", grip);
      return;
    }

    var properties = this.store.getPrototypeAndProperties(grip);
    if (properties instanceof Promise) {
      return properties;
    }

    // Compute list of requested children.
    var children = Object.keys(properties).map(key => {
      return new Property(key, properties[key]);
    });

    function sortName(a, b) { return a.name > b.name ? 1 : -1; }
    children.sort(sortName);

    var length = children ? children.length : "";
    Trace.sysout("TooltipProvider.getChildren; result: " + length, {
      properties: properties,
      children: children
    });

    return children;
  },

  hasChildren: function(object) {
    if (object instanceof Property) {
      var value = this.getValue(object);
      return (value && value.type == "object" &&
        value.ownPropertyLength > 0);
    }
  },

  getValue: function(object) {
    if (object instanceof Property) {
      var value = object.value;
      return (typeof value.value != "undefined") ? value.value :
        value.getterValue;
    }

    return object;
  },

  getLabel: function(object) {
    if (object instanceof Property) {
      return object.name;
    }

    return object;
  },

  // ID Provider. Used e.g. for tree persistence (list of expanded nodes).
  getId: function(object) {
  },
};

function Property(name, value) {
  this.name = name;
  this.value = value;
}

// Exports from this module
exports.TooltipProvider = TooltipProvider;
});
