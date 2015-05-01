/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const { Reps } = require("reps/repository");

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
 * Listen for messages from the Inspector panel (chrome scope).
 */
addEventListener("firequery/chrome/message", event => {
  var data = event.data;
  switch (data.type) {
  case "render":
    renderData(data.args);
    break;
  }
}, true);

/**
 * Render jQuery data associated with DOM elements.
 *
 * @param nodes List of nodes that have jQuery data associated.
 */
function renderData(nodes) {
  for (var i=0; i<nodes.length; i++) {
    var node = nodes[i];
    var value = node.jQueryData;
    var element = node.element;
    var parentNode = element.querySelector(".fireQueryData");

    // Get proper template for given value and render.
    var rep = Reps.getRep(value);
    Reps.render(rep, value, parentNode);
  }
}

// Final initialize message posted to the chrome indicating that
// all content modules has been successfully loaded.
postChromeMessage("ready");
});
