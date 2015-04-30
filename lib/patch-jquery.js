/* See license.txt for terms of usage */

"use strict";

var patchJQuery = function(jQuery, source) {
  if (jQuery.wrappedJSObject) {
    jQuery = jQuery.wrappedJSObject;
  }

  if (jQuery.fn.jquery.split(".")[0]!="1") {
    // jQuery 2.0+ path
    dbg("patchJQuery2+");
    //Firebug.CommandLine.evaluateInWebPage(code, context);
    return;
  }

  // jQuery 1.3+ path
  if (jQuery._patchedByFireQuery) {
    return;
  }

  jQuery._patchedByFireQuery = true;

  // taken from jQuery 1.7.1
  var myExtend = function() {
    var options, name, src, copy, copyIsArray, clone,
      target = arguments[0] || {},
      i = 1,
      length = arguments.length,
      deep = false;

    // Handle a deep copy situation
    if ( typeof target === "boolean" ) {
      deep = target;
      target = arguments[1] || {};
      // skip the boolean and the target
      i = 2;
    }

    // Handle case when target is a string or something
    // (possible in deep copy)
    if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
      target = {};
    }

    // extend jQuery itself if only one argument is passed
    if ( length === i ) {
      target = this;
      --i;
    }

    for ( ; i < length; i++ ) {
      // Only deal with non-null/undefined values
      if ( (options = arguments[ i ]) != null ) {
        // Extend the base object
        for ( name in options ) {
          src = target[ name ];
          copy = options[ name ];

          // Prevent never-ending loop
          if ( target === copy ) {
            continue;
          }

          // Recurse if we're merging plain objects or arrays
          if ( deep && copy && ( jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)) ) ) {
            if ( copyIsArray ) {
              copyIsArray = false;
              clone = src && jQuery.isArray(src) ? src : [];
            } else {
              clone = src && jQuery.isPlainObject(src) ? src : {};
            }

            // Never move original objects, clone them
            target[ name ] = myExtend( deep, clone, copy );

          // Don't bring in undefined values
          } else if ( copy !== undefined ) {
            target[ name ] = copy;
          }
        }
      }
    }

    // Return the modified object
    return target;
  };

  jQuery.__FireQueryShared = {
    getPref: function(x) { // for some reason we need to wrap it
      return Firebug.FireQuery.getPref(x);
    },
    extend: function() {
      return myExtend.apply(this, Array.prototype.slice.apply(arguments));
    },
    eq: isEqual,
      __exposedProps__ : {
        getPref: "r",
        extend: "r",
        eq: "r"
    }
  };

  var jQuery_data = jQuery.data;
  jQuery.__FireQueryShared.data_originalReplacedByFireQuery = function() {
    var res = jQuery_data.apply(this, Array.prototype.slice.apply(arguments));
    return {
      res: res,
      __exposedProps__ : {
        res: "rw"
      }
    }
  };

  jQuery.__FireQueryShared.__exposedProps__.data_originalReplacedByFireQuery = "r";
  jQuery.data = function(elem, name, data, showInternals) {
    var originalDataImplementation = this.__FireQueryShared.data_originalReplacedByFireQuery;
    // since jQuery 1.7, jQuery.data() does not show internal jQuery data structures like 'events'
    // there is a 4th optional private parameter on jQuery.data() which enables original behavior
    // https://github.com/darwin/firequery/issues/24
    var reading = (data===undefined && !(typeof name === "object" || typeof name === "function")); // when reading values
    var writing = !reading;
    var forceInternals = this.__FireQueryShared.getPref('showInternalData')?true:undefined;
    if (writing) {
      var snapshot = originalDataImplementation.apply(this, [elem, undefined, undefined, forceInternals]).res;
      var oldData = this.__FireQueryShared.extend(true, {}, snapshot); // need to do a deep copy of the whole structure
    }
    var res = originalDataImplementation.apply(this, [elem, name, data, showInternals]).res;
    if (writing) {
      try {
        var newData = originalDataImplementation.apply(this, [elem, undefined, undefined, forceInternals]).res;
        // add/modify all newData
        for (var item in newData) {
          if (newData.hasOwnProperty(item)) {
            if (!this.__FireQueryShared.eq(oldData[item], newData[item], [], [])) { // highlight only modified items
              //mutateData.call(context.getPanel('html'), elem, MODIFICATION, item, newData[item]);
            }
          }
        }
        // remove missing oldData
        for (var item in oldData) {
          if (!newData.hasOwnProperty(item)) {
            //mutateData.call(context.getPanel('html'), elem, REMOVAL, item);
          }
        }
      } catch (ex) {
        // html panel may not exist yet (also want to be safe, when our highlighter throws for any reason)
        dbg("   ! ", ex);
      }
    }
    return res;
  };

  var jQuery_removeData = jQuery.removeData;
  jQuery.__FireQueryShared.removeData_originalReplacedByFireQuery = function() {
    var res = jQuery_removeData.apply(this, Array.prototype.slice.apply(arguments));
    return {
      res: res,
      __exposedProps__ : {
          res: "rw"
      }
    }
  };

  jQuery.__FireQueryShared.__exposedProps__.removeData_originalReplacedByFireQuery = "r";
  jQuery.removeData = function(elem, name) {
    var originalDataImplementation = this.__FireQueryShared.data_originalReplacedByFireQuery;
    var forceInternals = this.__FireQueryShared.getPref('showInternalData')?true:undefined;
    var snapshot = originalDataImplementation.apply(this, [elem, undefined, undefined, forceInternals]).res;
    var oldData = this.__FireQueryShared.extend(true, {}, snapshot); // need to do a deep copy of the whole structure
    var res = this.__FireQueryShared.removeData_originalReplacedByFireQuery.apply(this, Array.prototype.slice.apply(arguments)).res;
    try {
      var newData = originalDataImplementation.apply(this, [elem, undefined, undefined, forceInternals]).res;
      // add/modify all newData
      for (var item in newData) {
        if (newData.hasOwnProperty(item)) {
          if (!this.__FireQueryShared.eq(oldData[item], newData[item], [], [])) { // highlight only modified items
            //mutateData.call(context.getPanel('html'), elem, MODIFICATION, item, newData[item]);
          }
        }
      }
      // remove missing oldData
      for (var item in oldData) {
        if (!newData.hasOwnProperty(item)) {
          mutateData.call(context.getPanel('html'), elem, REMOVAL, item);
        }
      }
    } catch (ex) {
      // html panel may not exist yet (also want to be safe, when our highlighter throws for any reason)
      dbg("   ! "+ex);
    }
    return res;
  };

  // apply jquery lint if requested
  if (Firebug.FireQuery.getPref('useLint')) {
    try {
      var code = Firebug.FireQuery.prepareJQueryLintCode();
      //Firebug.CommandLine.evaluateInWebPage(code, context);
    } catch (ex) {
      dbg("   ! "+ex);
    }
  }
};

var installJQueryWatcher = function(win) {
  try {
    var code = jQueryWatcherCode.replace(/\{\{watcherInterval\}\}/g,
      Firebug.FireQuery.getPref("watcherInterval"));

    //Firebug.CommandLine.evaluateInWebPage(code, context);
  } catch (ex) {
    dbg("   ! " + ex);
  }
};

var processFireQueryEvent = function(event) {
  var elem = event.target;
  var oldData = event.detail.oldValues;
  var newData = event.detail.newValues;

  try {
    // add/modify all newData
    for (var item in newData) {
      if (newData.hasOwnProperty(item)) {
        if (!isEqual(oldData[item], newData[item], [], [])) {
          // highlight only modified items
          //mutateData.call(context.getPanel('html'), elem,
          //  MODIFICATION, item, newData[item]);
        }
      }
    }

    // remove missing oldData
    for (var item in oldData) {
      if (!newData.hasOwnProperty(item)) {
        //mutateData.call(context.getPanel('html'), elem, REMOVAL, item);
      }
    }
  } catch (ex) {
    // html panel may not exist yet (also want to be safe,
    // when our highlighter throws for any reason)
    dbg("   ! " + ex);
  }
};

var patchWindow = function(win, source) {
  try {
    var wrapper = win.wrappedJSObject;
    var jQuery = wrapper.jQuery;
    patchJQuery(jQuery, source);
    dbg(">>>FireQuery: successfully found and patched jQuery in the window ", win);
  } catch (ex) {
    dbg('>>>FireQuery: jQuery not found in the window, running watcher ...', win);

    win.document.wrappedJSObject.addEventListener("jQueryDetected", function() {
      try {
        var wrapper = win.wrappedJSObject;
        var jQuery = wrapper.jQuery;
        patchJQuery(jQuery, source);
        dbg(">>>FireQuery: successfully notified and patched late jQuery in the window ", win);
      } catch (ex) {
        dbg(">>>FireQuery: fatal error patching late jQuery in the window ", ex);
      }
    }, true);

    win.document.wrappedJSObject.addEventListener("firequery-event", function(event) {
      try {
        processFireQueryEvent(event);
      } catch (ex) {
        dbg(">>>FireQuery: error when processing firequery event from the page ", ex);
      }
    }, true);

    installJQueryWatcher(win);
  }
};

// Tracing

var dbg = msg => {}

// Exports from this module
exports.patchWindow = patchWindow;
