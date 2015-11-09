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
        var hh = hdrs[h].trim().split('|');
        headers[hh[0]] = hh[1];
    }
    return headers;
};

// lee un hook para testear
testHelper.readSampleWebHook = function readSampleWebHook(hookName) {
    var wh={};
    var baseDir='./test/webhooks/';
    return Promises.start(function() {
        return fs.readFile(baseDir+hookName+'.headers', {encoding:'utf8'});
    }).then(function(content) {
        wh['headers'] = headersFromFile(content);
        return fs.readFile(baseDir+hookName+'.raw', {encoding:'utf8'});
    }).then(function(content) {
        //console.log(hookName, content.length)
        wh['payload'] = content;
        return wh;
    });
};

testHelper.dirTemp;

if(process.env.TRAVIS){
    testHelper.dirTemp = process.env.HOME;
}else{
    testHelper.dirTemp = process.env.TMP || process.env.TEMP || '/tmp';
}
testHelper.dirTemp+='/temp-qcs';

testHelper.testConfig = {
    //repository:'./test/fixtures/repo4display',
    repository: {
        path: testHelper.dirTemp+'/repo4display',
        request_secret:'elsecreto'
    }
};

// hook global
before(function(done){
    this.timeout(5000);
    Promises.start(function(){
        return fs.remove(testHelper.dirTemp);
    }).then(function(){
        return fs.copy('./test/fixtures', testHelper.dirTemp, {clobber:true});
    }).then(function(){
        done();
    }).catch(function(err){
        console.log(err);
        done(_.isArray(err)?err[0]:err);
    });
});
    
module.exports = testHelper;
