"use strict";

var expect = require('expect.js');
var Promises = require('best-promise');
var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
var Path = require('path');
var helper=require('../test/test.helper.js');

describe('content validation', function(){
    var secretKey = 'elsecreto';
    it('payload should validate with secret key', function(done){
        fs.readFile('./test/hmac.payload', {encoding: 'utf8'}).then(function(payload) {
            expect(qacServices.isValidRequest(payload, 'sha1=49ee18e35e373f08f6984e5e40f885030e81105b', secretKey)).to.be.ok();
            done();
        }).catch(function(err) {
            console.log("mal", err);
            done(err);
        });
    });
    it('all sample WebHooks should have valid hashes', function(done){
        var basePath='./test/webhooks';
        var samples={};
        return fs.readdir(basePath).then(function(files) {
            return Promises.all(files.map(function(file){
                var iFile = Path.normalize(basePath+'/'+file);
                return Promises.start(function() {
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
                //console.log('signature', wh.headers['X-Hub-Signature']);
                expect(qacServices.isValidRequest(wh.payload, wh.headers['X-Hub-Signature'], secretKey)).to.be.ok();
            }
        }).catch(function(err) {
            console.log("mal", err);
            done(err);
        });
    });
});