"use strict";
var expect = require('expect.js');
var qacServices = require('../lib/qac-services.js');
var qacCommon = require('../lib/qcs-common.js');
var helper=require('../test/test-helper.js');
var html = require('js-to-html').html;
var sinon = require('sinon');
var Promises = require('best-promise');
var fs = require('fs-promise');
var Path = require('path');

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
    describe('button generation', function() {
        var org='una-organization', proj='un-proyecto';
        it('project actions unlogged', function(done) {
            expect(qacServices.projectActionButtons(org, proj)).to.eql([]);
            done();
        });
        it('organization/project add actions unlogged', function(done) {
            expect(qacServices.orgAddButton()).to.eql([]);
            expect(qacServices.projectAddButton()).to.eql([]);
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
    describe('getProject', function() {
        it('wrong error', function(done) {
            var orga='la-org', proj='el-proj';
            sinon.stub(fs, 'readFile', function(nameCucardas){
                //console.log("nameCucardas", nameCucardas);
                switch(nameCucardas){
                    case Path.normalize('la-org-path/projects/'+proj+'/result/cucardas.md'): return Promises.reject({code:'not-ENOENT'});
                    default: throw new Error('unexpected params in readFile of cucardas');
                }
            });
            qacServices.getProject({organization:{name:orga, path:'la-org-path'}}, {projectName:proj}).catch(function(err) {
                fs.readFile.restore();
                expect(err.code).to.eql('not-ENOENT');
                done();
            }).catch(function(que) {
                done('should not happen');
            })
        });
    });
    describe('functions', function() {
        it('md5Prefixed', function(done) {
            expect(qacServices.md5Prefixed('guest')).to.eql('md5.084e0343a0486ff05530df6c705c8bb4');
            done();
        });
        it('noCacheHeaders', function(done) {
            function Req() {
                this.v1 = '';
                this.v2 = '';
                var yo =this;
                this.header=function(p1, p2) {
                    yo.v1 = p1;
                    yo.v2 = p2;
                };
            }
            var req = new Req();
            qacServices.noCacheHeaders(req);
            expect(req.v1).to.eql('Cache-Control');
            expect(req.v2).to.eql('no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
            done();
        });
        it('sortProjects', function(done) {
            var p1={content:[{content:[{attributes:{href:'Alerta'}}]}]};
            var p2={content:[{content:[{attributes:{href:'Roja'}}]}]};
            expect(qacServices.sortProjects(p1, p2)).to.eql(-1);
            expect(qacServices.sortProjects(p2, p1)).to.eql(1);
            expect(qacServices.sortProjects(p1, p1)).to.eql(0);
            done();
        });
        it('invalidSVG', function(done) {
            qacServices.invalidSVG().then(function(svg) {
               var msv = '<svg xmlns="http://www.w3.org/2000/svg" width="115" height="20">'+
                                  '<linearGradient id="b" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/>'+
                                  '<stop offset="1" stop-opacity=".1"/></linearGradient><mask id="a">'+
                                  '<rect width="115" height="20" rx="3" fill="#fff"/></mask><g mask="url(#a)">'+
                                  '<path fill="#555" d="M0 0h68v20H0z"/><path fill="#9f9f9f" d="M68 0h47v20H68z"/>'+
                                  '<path fill="url(#b)" d="M0 0h115v20H0z"/></g>'+
                                  '<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">'+
                                  '<text x="34" y="15" fill="#010101" fill-opacity=".3">qa-control</text>'+
                                  '<text x="34" y="14">qa-control</text><text x="90.5" y="15" fill="#010101" fill-opacity=".3">invalid</text>'+
                                  '<text x="90.5" y="14">invalid</text></g></svg>';
               expect(svg).to.eql(msv); 
               done();
            });
        }, function(err) {
            console.log("err", err);
            done(err);
        });
        it('gitHubUrl', function(done) {
            var url = {uri: 'https://api.github.com/uno/dos/repos', headers: { 'User-Agent': 'Request-Promise' } };
            expect(qacServices.gitHubUrl('uno', 'dos')).to.eql(url);
            url.uri = 'https://api.github.com/tres/cuatro/repos';
            expect(qacServices.gitHubUrl('tres', 'cuatro')).to.eql(url);
            done();
        });
        it('uriIsHandled', function(done) {
            expect(qacServices.uriIsHandled({params:{organization: 'login'}})).to.be.ok();
            expect(qacServices.uriIsHandled({params:{organization: 'manual-delete'}})).to.be.ok();
            expect(qacServices.uriIsHandled({params:{organization: 'anual-delete'}})).to.not.be.ok();
            done();
        });
    });
});
