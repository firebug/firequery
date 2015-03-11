/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const options = require("@loader/options");

const { Cu, Ci } = require("chrome");
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Class } = require("sdk/core/heritage");
const { Locale } = require("firebug.sdk/lib/core/locale.js");
const { ToolboxOverlay } = require("firebug.sdk/lib/toolbox-overlay.js");

/**
 * @overlay This object represents an overlay for the Toolbox. The
 * overlay is created when the Toolbox is opened and destroyed when
 * the Toolbox is closed. There is one instance of the overlay per
 * Toolbox, and so there can be more overlay instances created per
 * one browser session.
 */
const FireQueryToolboxOverlay = Class(
/** @lends FireQueryToolboxOverlay */
{
  extends: ToolboxOverlay,

  overlayId: "FireQueryToolboxOverlay",

  // Initialization

  initialize: function(options) {
    ToolboxOverlay.prototype.initialize.apply(this, arguments);

    Trace.sysout("FireQueryToolboxOverlay.initialize;", options);
  },

  destroy: function() {
    ToolboxOverlay.prototype.destroy.apply(this, arguments);

    Trace.sysout("FireQueryToolboxOverlay.destroy;", arguments);

    if (this.pixelPerfectPopup) {
      this.pixelPerfectPopup.destroy();
    }
  },

  // Events

  onReady: function(options) {
    ToolboxOverlay.prototype.onReady.apply(this, arguments);

    Trace.sysout("FireQueryToolboxOverlay.onReady;", options);
  },
});

// Exports from this module
exports.FireQueryToolboxOverlay = FireQueryToolboxOverlay;
