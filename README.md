FireQuery
=========

Firefox plugin for jQuery development. Built on top of native
developer tools in Firefox. [Firebug 3] isn't required, but the
screen-shot below shows how native developer tools look like
when Firebug theme is activated.

![](https://raw.githubusercontent.com/firebug/firequery/master/docs/images/console.png)

Try it for yourself:

1. Install [FireQuery](https://github.com/firebug/firequery/releases) (currently beta)
2. Load `http://getfirebug.com/`
3. Execute `$('span')` on Console panel Command line.
4. Check out the `jQuery` object logged in the Console panel.

Note that elements with [jQuery data](http://api.jquery.com/data/) associated
display a little envelop. You can inspect the data by clicking on the envelop.

License
-------
FireQuery is free and open source software distributed under the
[BSD License](https://github.com/firebug/firequery/blob/master/license.txt).

Hacking on FireQuery
--------------------
See FireQuery [Developer Guide](https://github.com/firebug/firequery/wiki/Developer-Guide)

Further Resources
-----------------
* DevTools Extension Examples: https://github.com/mozilla/addon-sdk/tree/devtools/examples
