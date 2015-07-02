/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const { prefs } = require("sdk/simple-prefs");

/**
 * Wait till jQuery is initialized on the current page and send
 * an event when it happens.
 */
const jQueryWatcherCode = "\
(function() {\
  var timerId = setInterval(function() {\
    if (window.jQuery) {\
      clearInterval(timerId);\
      var event = document.createEvent('Events');\
      event.initEvent('jQueryDetected', true, false);\
      document.dispatchEvent(event);\
    }\
  }, {{watcherInterval}});\
})();\
";

function getJQueryWatcherCode() {
  let watcherInterval = prefs.watcherInterval || 1000;

  var code = jQueryWatcherCode;
  var code = code.replace(/\{\{watcherInterval\}\}/g, watcherInterval);
  return code;
}

// Exports from this module
exports.getJQueryWatcherCode = getJQueryWatcherCode;
