/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
var React = require("react");

// Firebug SDK
const { TreeView } = require("reps/tree-view");
const { Reps } = require("reps/repository");

// FireQuery
const { TooltipProvider } = require("./tooltip-provider");
const { GripStore } = require("./grip-store");
const { Dispatcher } = require("./dispatcher");
const { TooltipContent } = require("./tooltip-content");

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
function initialize(data) {
  rootGrip = JSON.parse(data.grip);

  Trace.sysout("MarkupTooltip; initialize " + rootGrip.actor, {
    data: data,
    rootGrip: rootGrip
  });

  // Set the current theme. The value comes directly from
  // 'devtools.theme' preference, so make sure to properly
  // convert it into class name.
  document.body.classList.add("theme-" + data.theme);
  document.documentElement.classList.add("theme-" + data.theme);

  // Get content ready for rendering.
  var store = new GripStore();
  var content = TooltipContent({
    provider: new TooltipProvider(store),
    data: rootGrip,
    mode: "tiny"
  });

  // ... and render the top level RJS component.
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

/**
 * Navigation within the toolbox
 */
function onNavigate(event) {
  var target = event.target;
  var repObject = event.detail.repObject;

  postChromeMessage("navigate", repObject);
}
addEventListener("fbsdk:navigate", onNavigate, true);

// Final initialize message posted to the chrome indicating that
// all content modules has been successfully loaded.
postChromeMessage("ready");
});
