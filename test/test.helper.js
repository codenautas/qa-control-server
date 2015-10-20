"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var testHelper = {};

testHelper.headersFromFile = function headersFromFile(content) {
    var hdrs = content.split('\n');
    var headers = {};
    for(var h in hdrs) {
        var hh = hdrs[h].split('|');
        headers[hh[0]] = hh[1];
    }
    return headers;
};

testHelper.testConfig = {
    repository:'./test/fixtures/repo4display'
};

module.exports = testHelper;
