"use strict";
var expect = require('expect.js');
var qacServices = require('../lib/qac-services.js');
var qacCommon = require('../lib/qcs-common.js');
var helper=require('../test/test-helper.js');
var html = require('js-to-html').html;

describe('qac-services coverage', function(){
    helper.setup(qacServices);
    describe('common', function() {
        helper.setup(qacServices);
        var expHeads = [
                        html.link({href:'/markdown.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/markdown2.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/github.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/qcs.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/favicon.ico', rel:'shortcut icon'})
                          ];
        it('simpleHead', function(done) {
            var sh = qacCommon.simpleHead();
            expect(sh).to.eql(html.head(expHeads));
            done();
        });
        it('simpleHead with params', function(done) {
            var sh = qacCommon.simpleHead('optional.css');
            expHeads.splice(4, 0, html.link({href:'optional.css', media:'all', rel:'stylesheet'}));
            expect(sh).to.eql(html.head(expHeads));
            done();
        });
    });
 });