"use strict";
var expect = require('expect.js');
var qacServices = require('../lib/qac-services.js');
var qacCommon = require('../lib/qcs-common.js');
var helper=require('../test/test-helper.js');
var html = require('js-to-html').html;

describe('qac-services coverage', function(){
    // helper.setup(qacServices);
    describe('common', function() {
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
        var title = "un titulo", content="el contenido";
        var css = '/extra.css';
        var exCSS = "<link href='"+css+"' media=all rel=stylesheet>";
        function expHT(title, content, css) {
            return "<!doctype html>\n"+
                  "<html><head><title>"+title+"</title><link href='/markdown.css' media=all rel=stylesheet>"+
                  "<link href='/markdown2.css' media=all rel=stylesheet><link href='/github.css' media=all rel=stylesheet>"+
                  "<link href='/qcs.css' media=all rel=stylesheet>"+
                  css+"<link rel='shortcut icon' href='/favicon.ico'></head>"+
                  "<body>"+content+"</body></html>"
        }
        it('simpleHtml', function(done) {
            var sh = qacCommon.simpleHtml(title, content);
            expect(sh).to.eql(expHT(title, content, ""));
            done();
        });
        it('simpleHtml with params', function(done) {
            var sh = qacCommon.simpleHtml(title, content, css);
            expect(sh).to.eql(expHT(title, content, exCSS));
            done();
        });
        it('simpleHtml without title', function(done) {
            var sh = qacCommon.simpleHtml(null, content, css);
            expect(sh).to.eql(expHT('qa-control', content, exCSS));
            done();
        });
    });
    describe('config', function() {
        it('wrong params', function(done) {
            expect(qacServices.config).withArgs(null).to.throwException(/must set 'production' in config/);
            expect(qacServices.config).withArgs(true, false).to.not.throwException();
            expect(qacServices.production).to.not.be.ok();
            done();
        });
    });
 });