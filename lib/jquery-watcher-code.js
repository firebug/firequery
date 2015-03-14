/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

/**
 * xxxHonza TODO docs
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

// Exports from this module
exports.jQueryWatcherCode = jQueryWatcherCode;
