/**
 * @fileoverview Source code for spaced-comments rule
 * @author Gyandeep Singh
 * @copyright 2015 Toru Nagashima. All rights reserved.
 * @copyright 2015 Gyandeep Singh. All rights reserved.
 * @copyright 2014 Greg Cochard. All rights reserved.
 */
"use strict";

var escapeStringRegexp = require("escape-string-regexp");

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Escapes the control characters of a given string.
 * @param {string} s - A string to escape.
 * @returns {string} An escaped string.
 */
function escape(s) {
    var isOneChar = s.length === 1;
    s = escapeStringRegexp(s);
    return isOneChar ? s : "(?:" + s + ")";
}

/**
 * Escapes the control characters of a given string.
 * And adds a repeat flag.
 * @param {string} s - A string to escape.
 * @returns {string} An escaped string.
 */
function escapeAndRepeat(s) {
    return escape(s) + "+";
}

/**
 * Parses `markers` option.
 * If markers don't include `"*"`, this adds `"*"` to allow JSDoc comments.
 * @param {string[]|null} markers - A marker list.
 * @returns {string[]} A marker list.
 */
function parseMarkersOption(markers) {
    if (markers == null) {
        markers = [];
    }

    // `*` is a marker for JSDoc comments.
    if (markers.indexOf("*") === -1) {
        markers.push("*");
    }

    return markers;
}

/**
 * Parses `exceptions` option.
 * @param {string[]|null} exceptions - An exception list.
 * @returns {string[]} An exception list.
 */
function parseExceptionsOption(exceptions) {
    return exceptions || [];
}

/**
 * Creates RegExp object for `always` mode.
 * Generated pattern is below:
 *
 * 1. First, a marker or nothing.
 * 2. Next, a space or an exception pattern sequence.
 *
 * @param {string[]} markers - A marker list.
 * @param {string[]} exceptions - A exception pattern list.
 * @returns {RegExp} A RegExp object for `always` mode.
 */
function createAlwaysStylePattern(markers, exceptions) {
    var pattern = "^";

    // A marker or nothing.
    //   ["*"]            ==> "\*?"
    //   ["*", "!"]       ==> "(?:\*|!)?"
    //   ["*", "/", "!<"] ==> "(?:\*|\/|(?:!<))?" ==> https://jex.im/regulex/#!embed=false&flags=&re=(%3F%3A%5C*%7C%5C%2F%7C(%3F%3A!%3C))%3F
    if (markers.length === 1) {
        // the marker.
        pattern += escape(markers[0]);
    } else {
        // one of markers.
        pattern += "(?:";
        pattern += markers.map(escape).join("|");
        pattern += ")";
    }
    pattern += "?"; // or nothing.

    // A space or an exception pattern sequence.
    //   []                 ==> "\s"
    //   ["-"]              ==> "(?:\s|\-+$)"
    //   ["-", "="]         ==> "(?:\s|(?:\-+|=+)$)"
    //   ["-", "=", "--=="] ==> "(?:\s|(?:\-+|=+|(?:\-\-==)+)$)" ==> https://jex.im/regulex/#!embed=false&flags=&re=(%3F%3A%5Cs%7C(%3F%3A%5C-%2B%7C%3D%2B%7C(%3F%3A%5C-%5C-%3D%3D)%2B)%24)
    if (exceptions.length === 0) {
        // a space.
        pattern += "\\s";
    } else {
        // a space or...
        pattern += "(?:\\s|";
        if (exceptions.length === 1) {
            // a sequence of the exception pattern.
            pattern += escapeAndRepeat(exceptions[0]);
        } else {
            // a sequence of one of exception patterns.
            pattern += "(?:";
            pattern += exceptions.map(escapeAndRepeat).join("|");
            pattern += ")";
        }
        pattern += "$)"; // the sequence continues until the end.
    }

    return new RegExp(pattern);
}

/**
 * Creates RegExp object for `never` mode.
 * Generated pattern is below:
 *
 * 1. First, a marker or nothing (captured).
 * 2. Next, a space or a tab.
 *
 * @param {string[]} markers - A marker list.
 * @returns {RegExp} A RegExp object for `never` mode.
 */
function createNeverStylePattern(markers) {
    var pattern = "^(" + markers.map(escape).join("|") + ")?[ \t]";
    return new RegExp(pattern);
}

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = function(context) {
    // Unless the first option is never, require a space
    var requireSpace = context.options[0] !== "never";

    // Parse the second options.
    // If markers don't include `"*"`, it's added automatically for JSDoc comments.
    var markers = parseMarkersOption(context.options[1] && context.options[1].markers);
    var exceptions = parseExceptionsOption(context.options[1] && context.options[1].exceptions);

    // Create RegExp object for valid patterns.
    var stylePattern = null;
    if (requireSpace) {
        stylePattern = createAlwaysStylePattern(markers, exceptions);
    } else {
        stylePattern = createNeverStylePattern(markers);
    }

    /**
     * Reports a given comment if it's invalid.
     * @param {ASTNode} node - a comment node to check.
     * @returns {void}
     */
    function checkCommentForSpace(node) {
        var commentIdentifier = node.type === "Block" ? "/*" : "//";

        // Ignores empty comments.
        if (node.value.length === 0) {
            return;
        }

        // Checks.
        if (requireSpace) {
            if (!stylePattern.test(node.value)) {
                if (exceptions.length > 0) {
                    context.report(node, "Expected exception block, space or tab after " + commentIdentifier + " in comment.");
                } else {
                    context.report(node, "Expected space or tab after " + commentIdentifier + " in comment.");
                }
            }
        } else {
            var matched = stylePattern.exec(node.value);
            if (matched) {
                if (matched[1] == null) {
                    context.report(node, "Unexpected space or tab after " + commentIdentifier + " in comment.");
                } else {
                    context.report(node, "Unexpected space or tab after marker (" + matched[1] + ") in comment.");
                }
            }
        }
    }

    return {

        "LineComment": checkCommentForSpace,
        "BlockComment": checkCommentForSpace

    };
};

module.exports.schema = [
    {
        "enum": ["always", "never"]
    },
    {
        "type": "object",
        "properties": {
            "exceptions": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            },
            "markers": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            }
        },
        "additionalProperties": false
    }
];
