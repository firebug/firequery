/* See license.txt for terms of usage */

define(function(require, exports, module) {

// Dependencies
const React = require("react");

/**
 * Post message to the chrome through DOM event dispatcher.
 * (there is no message manager for the markupview.xhtml frame).
 */
function postChromeMessage(type, data) {
  const event = new MessageEvent("firequery/message", {
    bubbles: true,
    cancelable: true,
    type: type,
    data: data,
  });

  dispatchEvent(event);
}

postChromeMessage("test", "a message from the content");

// End of inspector.js
});
