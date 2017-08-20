"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var fs = require('fs-extra');
var Path = require('path');

var testDir = {};

if(process.env.TRAVIS){
    testDir.temp = process.env.HOME;
}else{
    testDir.temp = process.env.TMP || process.env.TEMP || '/tmp';
}

testDir.getDir = function getDir(topDir) {
    return Path.normalize(testDir.temp + '/' + topDir); 
};

module.exports = testDir;
