"use strict";

var expect = require('expect.js');
var Promises = require('best-promise');
//var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
//var Path = require('path');
//var helper=require('../test/test-helper.js');

describe('qcs-services functions', function(){
    describe('getInfo', function() {
        it('should fail with missing parameters', function(done) {
           return qacServices.getInfo(null, null).then(function(info) {
                done('should fail');
            }).catch(function(err) {
                expect(err.message).to.match(/missing parameter/);
                done();
            });
        });
        it('should fail with missing group', function(done) {
            return qacServices.getInfo('non-existent-group', 'the-app').then(function(info) {
                done('should fail');
            }).catch(function(err) {
                //console.log("err", err);
                expect(err.message).to.match(/missing group/);
                done();
            });
        });
        it('should fail with missing project', function(done) {
           return qacServices.getInfo('sourcetravelers', 'not-an-app').then(function(info) {
               done('should fail');
           }).catch(function(err) {
               expect(err.message).to.match(/missing project/);
               done();
           });
        });
    });
});