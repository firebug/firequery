/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
var React = require("react");

// Firebug SDK
const { TreeView } = require("reps/tree-view");

// FireQuery
const { TooltipProvider } = require("./tooltip-provider");
const { GripStore } = require("./grip-store");
const { Dispatcher } = require("./dispatcher");
const { TooltipContent } = require("./tooltip-content");

// Grip based reps
// TODO: move into Firebug.SDK as soon as it's stable.
require("./reps/regexp.js");
require("./reps/stylesheet.js");
require("./reps/event.js");
require("./reps/date-time.js");
require("./reps/css-rule.js");
require("./reps/text-node.js");
require("./reps/named-node-map.js");
require("./reps/attribute.js");
require("./reps/function.js");
require("./reps/array.js");
require("./reps/element.js");
require("./reps/document.js");
require("./reps/window.js");
require("./reps/grip.js");

var theApp;

// xxxHonza: API in this file implements mostly the communication
// between content and chrome scope. It duplicates API already
// presented in markup-view-content.js
// It would be great to have common module that can be included
// in a content scope and installing the communication channel
// automatically.

var rootGrip;

/**
 * Render tooltip content (expandable tree)
 */
function initialize(grip) {
  rootGrip = JSON.parse(grip);

  Trace.sysout("MarkupTooltip; initialize " + rootGrip.actor, rootGrip);

  var store = new GripStore();
  var content = TooltipContent({
    provider: new TooltipProvider(store),
    data: rootGrip,
    mode: "tiny"
  });

  theApp = React.render(content, document.querySelector("#content"));
}

/**
 * Update content
 */
Dispatcher.on("update", event => {
  Trace.sysout("MarkupTooltip; Update " + event.from, {
    event: event,
    theApp: theApp
  });

  theApp.setState({
    forceUpdate: (event.grip.actor == rootGrip.actor),
    data: theApp.state.data
  });

  updateSize();
});

/**
 * Listen for messages from the Inspector panel (chrome scope).
 */
addEventListener("firequery/chrome/message", event => {
  var data = event.data;
  switch (data.type) {
  case "initialize":
    initialize(data.args);
    break;
  }
}, true);

/**
 * Post message to the chrome through DOM event dispatcher.
 * (there is no message manager for the markupview.xhtml frame).
 */
function postChromeMessage(type, args) {
  var data = {
    type: type,
    args: args,
  };

  var event = new MessageEvent("firequery/content/message", {
    bubbles: true,
    cancelable: true,
    data: data,
  });

  dispatchEvent(event);
}

/**
 * Send a message to the chrome to update size of the tooltip.
 */
function updateSize() {
  var size = getRequiredSize();
  postChromeMessage("resize", size);
}

/**
 * Returns ideal size of the tooltip required by the content.
 */
function getRequiredSize() {
  var tree = document.querySelector(".domTable");
  return {
    height: tree.clientHeight,
    width: tree.clientWidth
  }
}

/**
 * Update window size on click.
 */
addEventListener("click", updateSize);

// Final initialize message posted to the chrome indicating that
// all content modules has been successfully loaded.
postChromeMessage("ready");
});
