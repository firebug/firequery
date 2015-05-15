/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "experimental"
};

// Add-on SDK
const { Cu, Ci } = require("chrome");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);

// DevTools
const { devtools } = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const { MarkupView } = devtools["require"]("devtools/markupview/markup-view");

// Patching MarkupView
// xxxHonza: Bug 1036949 - New API: MarkupView customization
let originalTemplate = MarkupView.prototype.template;
MarkupView.prototype.template = function(aName, aDest, aOptions) {
  let node = originalTemplate.apply(this, arguments);
  //this._inspector.emit("markupview-render", node, aName, aDest, aOptions);
  return node;
}

let originalImportNode = MarkupView.prototype.importNode;
MarkupView.prototype.importNode = function(aNode, aFlashNode) {
  let has = this._containers.has(aNode);
  let container = originalImportNode.apply(this, arguments);

  if (has) {
    return container;
  }

  if (!container) {
    return null;
  }

  //this._inspector.emit("container-created", container);

  return container;
}

function shutdown() {
  MarkupView.prototype.template = originalTemplate;

  // xxxHonza: iterate also all existing instances
  // and un-patch
}

// Exports from this module
exports.shutdown = shutdown;
