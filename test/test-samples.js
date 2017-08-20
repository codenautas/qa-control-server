"use strict";

var expect = require('expect.js');
var fs = require('fs-extra');
var qacServices = require('../lib/qac-services.js');
var Path = require('path');
var helper=require('../test/test-helper.js');

describe('qac-services test sample data', function(){
    it('all sample WebHooks should have valid hashes', function(done){
        var basePath='./test/webhooks';
        var samples={};
        fs.readdir(basePath).then(function(files) {
            return Promise.all(files.map(function(file){
                var iFile = Path.normalize(basePath+'/'+file);
                return Promise.resolve().then(function() {
                    return fs.readFile(iFile, 'utf8');
                }).then(function(content) {
                    var kFile = file.substr(0, file.length-Path.extname(file).length);
                    if(!( kFile in samples)) {
                        samples[kFile] = {};
                        return helper.readSampleWebHook(kFile).then(function(wh) {
                           samples[kFile] = wh;
                        });
                     }
                });                    
            })).then(function() {
                done();
            });
        }).then(function() {
            for(var h in samples) {
                var wh=samples[h];
                //console.log(h, wh.headers, wh.payload.length);
                //console.log('signature', wh.headers['X-Hub-Signature']);
                expect(qacServices.isValidRequest(wh.payload, wh.headers['X-Hub-Signature'], helper.testConfig.repository.request_secret)).to.be.ok();
            }
        }).catch(function(err) {
            console.log("mal", err);
            done(err);
        });
    });
});