"use strict";

var expect = require('expect.js');
var Promises = require('best-promise');
var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');

describe('HMac', function(){
    it('payload should validate with secret key', function(done){
        fs.readFile('./test/hmac.payload', {encoding: 'utf8'}).then(function(payload) {
            expect(qacServices.isValidRequest(payload, 'sha1=49ee18e35e373f08f6984e5e40f885030e81105b', 'elsecreto')).to.be.ok();
            done();
        }).catch(function(err) {
            console.log("mal", err);
            done(err);
        });
    });
});