/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const { Cu, Ci } = require("chrome");
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { ToolboxChrome } = require("firebug.sdk/lib/toolbox-chrome.js");
const { Locale } = require("firebug.sdk/lib/core/locale.js");

/**
 * Entry point of the extension. Both 'main' and 'onUnload' methods are
 * exported from this module and executed automatically by Add-ons SDK.
 */
function main(options, callbacks) {
  Trace.sysout("main;", options);

  ToolboxChrome.initialize(options);
}

/**
 * Executed on browser shutdown or when the extension is
 * uninstalled/removed/disabled.
 * @param reason
 */
function onUnload(reason) {
  Trace.sysout("onUnload; " + reason);
}

// Exports from this module
exports.main = main;
exports.onUnload = onUnload;
