"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var Promises = require('best-promise');
var fs = require('fs-promise');
var testHelper = {};

function headersFromFile(content) {
    var hdrs = content.split('\n');
    var headers = {};
    for(var h in hdrs) {
        var hh = hdrs[h].split('|');
        headers[hh[0]] = hh[1];
    }
    return headers;
};

// lee un hook para testear
testHelper.readSampleWebHook = function readSampleWebHook(hookName) {
    var wh={};
    var baseDir='./test/webhooks/';
    return Promises.start(function() {
        return fs.readFile(baseDir+hookName+'.headers', 'utf8');
    }).then(function(content) {
        wh['headers'] = headersFromFile(content);
        return fs.readFile(baseDir+hookName+'.raw', 'utf8');
    }).then(function(content) {
       wh['payload'] = content;
       return wh;
    });
};

testHelper.testConfig = {
    repository:'./test/fixtures/repo4display',
    request_secret:'elsecreto'
};

module.exports = testHelper;
