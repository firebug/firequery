/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const React = require("react");

/**
 * Post message to the chrome through DOM event dispatcher.
 * (there is no message manager for the markupview.xhtml frame).
 */
function postChromeMessage(type, args) {
  var data = {
    type: type,
    args: args,
  };

  const event = new MessageEvent("firequery/message", {
    bubbles: true,
    cancelable: true,
    data: data,
  });

  dispatchEvent(event);
}

postChromeMessage("initialize");

// End of inspector.js
});
