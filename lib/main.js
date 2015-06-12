/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const { Cu, Ci } = require("chrome");

//Firebug.SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { ToolboxChrome } = require("firebug.sdk/lib/toolbox-chrome.js");
const { Locale } = require("firebug.sdk/lib/core/locale.js");

// FireQuery overlays
const { ConsoleOverlay } = require("./console-overlay.js");
const { InspectorOverlay } = require("./inspector-overlay.js");
const { FireQueryToolboxOverlay } = require("./firequery-toolbox-overlay.js");
const { StartButton } = require("./start-button.js");

// Localization files
Locale.registerStringBundle("chrome://firequery/locale/toolbox.properties");
Locale.registerStringBundle("chrome://firequery/locale/firequery.properties");
Locale.registerStringBundle("chrome://firequery-firebug.sdk/locale/reps.properties");

/**
 * Entry point of the extension. Both 'main' and 'onUnload' methods are
 * exported from this module and executed automatically by Add-ons SDK.
 */
function main(options, callbacks) {
  Trace.sysout("main;", options);

  ToolboxChrome.initialize(options);

  ToolboxChrome.registerToolboxOverlay(FireQueryToolboxOverlay);
  ToolboxChrome.registerPanelOverlay(ConsoleOverlay);
  ToolboxChrome.registerPanelOverlay(InspectorOverlay);
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

  ToolboxChrome.shutdown(reason);
}

// Exports from this module
exports.main = main;
exports.onUnload = onUnload;
