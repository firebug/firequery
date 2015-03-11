/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

const { Cu, Ci } = require("chrome");
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { ToolboxChrome } = require("firebug.sdk/lib/toolbox-chrome.js");
const { Locale } = require("firebug.sdk/lib/core/locale.js");

// FireQuery overlays
const { ConsoleOverlay } = require("./console-overlay.js");
const { InspectorOverlay } = require("./inspector-overlay.js");
const { FireQueryToolboxOverlay } = require("./firequery-toolbox-overlay.js");

// Localization files. All strings in the UI should be loaded from these
// files, so the entire extension can be localized into other languages.
Locale.registerStringBundle("chrome://firequery/locale/firequery.properties");

/**
 * Entry point of the extension. Both 'main' and 'onUnload' methods are
 * exported from this module and executed automatically by Add-ons SDK.
 */
function main(options, callbacks) {
  Trace.sysout("main;", options);

  ToolboxChrome.initialize(options);

  ToolboxChrome.registerPanelOverlay(ConsoleOverlay);
  ToolboxChrome.registerPanelOverlay(InspectorOverlay);
  ToolboxChrome.registerToolboxOverlay(FireQueryToolboxOverlay);
}

/**
 * Executed on browser shutdown or when the extension is
 * uninstalled/removed/disabled.
 */
function onUnload(reason) {
  Trace.sysout("onUnload; " + reason);

  ToolboxChrome.unregisterToolboxOverlay(FireQueryToolboxOverlay);
  ToolboxChrome.unregisterPanelOverlay(InspectorOverlay);
  ToolboxChrome.unregisterPanelOverlay(ConsoleOverlay);
}

// Exports from this module
exports.main = main;
exports.onUnload = onUnload;
