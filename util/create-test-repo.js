"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var Promises = require('best-promise');
var fs = require('fs-promise');
var Path = require('path');

var testDir = require('./test-dir.js');
var repoDir = testDir.getDir('qcs-test-repo');
var origDir = './test/fixtures';

Promises.start(function(){
    return fs.remove(repoDir);
}).then(function(){
    return fs.copy(origDir, repoDir, {clobber:true});
}).then(function(){
    return fs.readdir(origDir);
}).then(function(rd) {
    //console.log("rd", rd);
    console.log("Created test directory!\nYou should set your local-config-yaml (services.repository.path) with:\n"
                +Path.normalize(repoDir+'/'+rd[0]));
}).catch(function(err){
    console.log(err);
});

