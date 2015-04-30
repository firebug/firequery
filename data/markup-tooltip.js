/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
var React = require("react");
const { Reps } = require("reps/repository");
const { TreeView } = require("reps/tree-view");

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

function getRequiredSize() {
  var tree = document.querySelector(".domTable");
  return {
    height: tree.clientHeight,
    width: tree.clientWidth
  }
}

addEventListener("click", event => {
  var size = getRequiredSize();
  postChromeMessage("resize", size);
});

/**
 * Listen for messages from the Inspector panel (chrome scope).
 */
addEventListener("firequery/chrome/message", event => {
  var data = event.data;
  switch (data.type) {
  case "render":
    renderContent(data.args);
    break;
  }
}, true);

function renderContent(value) {
  var tree = TreeView({
    data: JSON.parse(value),
    mode: "tiny"
  });

  React.render(tree, document.querySelector("#content"));

  var size = getRequiredSize();
  postChromeMessage("resize", size);
}

// Final initialize message posted to the chrome indicating that
// all content modules has been successfully loaded.
postChromeMessage("ready");

});
