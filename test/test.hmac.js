"use strict";

var expect = require('expect.js');
var Promises = require('best-promise');
var fs = require('fs-promise');

describe('HMac', function(){
    it('payload test', function(done){
        fs.readFile('./test/hmac.payload', {encoding: 'utf8'}).then(function(payload) {
            //console.log("payload", payload);
            //expect()'sha1=49ee18e35e373f08f6984e5e40f885030e81105b'
            done();
        }).catch(function(err) {
            console.log("mal", err);
            done(err);
        });
    });
});