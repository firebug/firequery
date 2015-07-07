/* See license.txt for terms of usage */

"use strict";

define(function(require, exports, module) {

var Str = {};

Str.cropString = function(text, limit, alternativeText)
{
  if (!alternativeText) {
    alternativeText = "...";
  }

  // Make sure it's a string.
  text = String(text);

  // Use default limit if necessary.
  if (!limit) {
    limit = 50;//prefs["stringCropLength"];
  }

  // Crop the string only if a limit is actually specified.
  if (limit <= 0) {
    return text;
  }

  // Set the limit at least to the length of the alternative text
  // plus one character of the original text.
  if (limit <= alternativeText.length) {
    limit = alternativeText.length + 1;
  }

  var halfLimit = (limit - alternativeText.length) / 2;

  if (text.length > limit) {
    return text.substr(0, Math.ceil(halfLimit)) + alternativeText +
    text.substr(text.length - Math.floor(halfLimit));
  }

  return text;
};

Str.escapeNewLines = function(value) {
  return value.replace(/\r/gm, "\\r").replace(/\n/gm, "\\n");
};

Str.cropMultipleLines = function(text, limit) {
  return this.escapeNewLines(this.cropString(text, limit));
};

exports.Str = Str;
});
