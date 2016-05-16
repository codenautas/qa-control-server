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
var _ = require('lodash');

describe('qac-services coverage', function(){
    describe('common', function() {
        var expHeads = [
                        html.link({href:'/markdown.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/markdown2.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/github.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/qcs.css', media:'all', rel:'stylesheet'}),
                        html.link({href:'/favicon.ico', rel:'shortcut icon'})
                          ];
        it('simpleHead', function(done) {
            var sh = qacCommon.simpleHead(null, qacServices);
            expect(sh).to.eql(html.head(expHeads));
            done();
        });
        it('simpleHead with params', function(done) {
            var sh = qacCommon.simpleHead('optional.css', qacServices);
            expHeads.splice(4, 0, html.link({href:'/optional.css', media:'all', rel:'stylesheet'}));
            expect(sh).to.eql(html.head(expHeads));
            done();
        });
        var title = "un titulo", content="el contenido";
        var css = 'extra.css';
        var exCSS = "<link href='/"+css+"' media=all rel=stylesheet>";
        function expHT(title, content, css) {
            return "<!doctype html>\n"+
                  "<html><head><title>"+title+"</title><link href='/markdown.css' media=all rel=stylesheet>"+
                  "<link href='/markdown2.css' media=all rel=stylesheet><link href='/github.css' media=all rel=stylesheet>"+
                  "<link href='/qcs.css' media=all rel=stylesheet>"+
                  css+"<link rel='shortcut icon' href='/favicon.ico'></head>"+
                  "<body>"+content+"</body></html>"
        }
        it('simpleHtml', function(done) {
            var sh = qacCommon.simpleHtml(title, content, null, qacServices);
            expect(sh).to.eql(expHT(title, content, ""));
            done();
        });
        it('simpleHtml with params', function(done) {
            var sh = qacCommon.simpleHtml(title, content, css, qacServices);
            expect(sh).to.eql(expHT(title, content, exCSS));
            done();
        });
        it('simpleHtml without title', function(done) {
            var sh = qacCommon.simpleHtml(null, content, css, qacServices);
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
        it('initialization', function(done) {
            var miConfig = _.cloneDeep(helper.testConfig);
            miConfig['root-url'] = '/something';
            miConfig.repository.path = 'a-path';
            miConfig.repository.request_secret = 'a-secret';
            qacServices.config(miConfig, true);
            expect(qacServices.repository.path).to.eql('a-path');
            expect(qacServices.repository.request_secret).to.eql('a-secret');
            expect(qacServices.rootUrl).to.eql('/something');
            expect(qacServices.production).to.eql(true);
            helper.setup(qacServices); // restauro
            done();
        });
    });
    describe('project', function() {
        it('getProject() wrong error', function(done) {
            var orga='la-org', proj='el-proj';
            sinon.stub(fs, 'readFile', function(nameCucardas){
                //console.log("nameCucardas", nameCucardas);
                switch(nameCucardas){
                    case Path.normalize('la-org-path/projects/'+proj+'/result/cucardas.md'): return Promises.reject({code:'not-ENOENT'});
                    default: throw new Error('unexpected params in readFile of cucardas');
                }
            });
            qacServices.getProject(helper.session, {organization:{name:orga, path:'la-org-path'}}, {projectName:proj}).catch(function(err) {
                fs.readFile.restore();
                expect(err.code).to.eql('not-ENOENT');
                done();
            }).catch(function(que) {
                done('should not happen');
            })
        });
        it('getProjectLogs()', function(done) {
            var projPath = 'path-del-proyecto';
            sinon.stub(fs, 'readJSON', function(jsonPath){
                // console.log("jsonPath", jsonPath);
                switch(jsonPath){
                    case Path.normalize(projPath+'/result/qa-control-result.json'):
                        return Promises.resolve([
                            {"warning": "elwarning","params": ["index.js"],"scoring": {"customs": 1, "other":2}},
                            {"warning": "elwarning2", "scoring": {"customs": 1}}
                        ]);
                    case Path.normalize(projPath+'/result/bitacora.json'):
                        return Promises.resolve([
                            {"date": "fecha1", "origin": "command", "text": "git clone"},
                            {"date": "fecha2","origin": "exit","text": "0"},
                            {"date": "fecha3","origin": "shell","text": "el-shell"},
                            {"date": "fecha4","origin": "internal","text": "\"cucardas.md\" generated"}
                        ]);
                    default:
                        return Promises.reject('unexpected params in readJSON ['+jsonPath+']');
                }
            });
            qacServices.getProjectLogs(projPath).then(function(logs) {
                //console.log("logs", logs)
                var result=[
                    html.hr(),
                    html.table([
                        html.tr([
                            html.th({colspan:3}, 'QA Control result')
                        ]),
                        html.tr([ html.td('warning'), html.td('file'), html.td('scoring') ]),
                        html.tr([ html.td('elwarning'), html.td('index.js'), html.td('customs:1 other:2') ]),
                        html.tr([ html.td('elwarning2'), html.td(''), html.td('customs:1') ])
                        ]),
                    html.hr(),
                    html.table([
                        html.tr([ html.th('Actions log') ]),
                        html.tr([ html.td([ html.div({class:'stdout'}, 'git clone') ]) ]),
                        html.tr([ html.td([ html.div({class:'stdout'}, '0') ]) ]),
                        html.tr([ html.td([ html.div({class:'shell'}, 'el-shell') ]) ]),
                        html.tr([ html.td([ html.div({class:'internal'}, '\"cucardas.md\" generated') ]) ])
                        ])
                   ];
                expect(logs).to.eql(result);
                fs.readJSON.restore();
                done();
            }).catch(function(err) {
                console.log("ERR", err);
                done(err);
            });
        });
        it('getProjectLogs() errors', function(done) {
            var p1 = 'proyecto1';
            var p2 = 'proyecto2';
            sinon.stub(fs, 'readJSON', function(jsonPath){
                //console.log("jsonPath", jsonPath);
                switch(jsonPath){
                    case Path.normalize(p2+'/result/qa-control-result.json'): return Promises.resolve([]);
                    case Path.normalize(p1+'/result/bitacora.json'): return Promises.resolve([]);
                    default:
                        return Promises.reject({message:'unexpected params in readJSON ['+jsonPath+']', code:'not-ENOENT'});
                }
            });
            qacServices.getProjectLogs(p1).then(function(logs) { done('should fail 1'); }).catch(function(err) {
                expect(err.code).to.eql('not-ENOENT');
                return qacServices.getProjectLogs(p2);
            }).then(function(logs) { done('should fail 2'); }).catch(function(err) {
                expect(err.code).to.eql('not-ENOENT');
                fs.readJSON.restore();
                done();
            });
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
        it('uriIsHandled', function(done) {
            expect(qacServices.uriIsHandled({params:{organization: 'login'}})).to.be.ok();
            expect(qacServices.uriIsHandled({params:{organization: 'manual-delete'}})).to.be.ok();
            expect(qacServices.uriIsHandled({params:{organization: 'anual-delete'}})).to.not.be.ok();
            done();
        });
        it('enableLoginPlus', function(done) {
            expect(qacServices.enableLoginPlus).withArgs(null).to.throwException(/must provide path to users database/);
            expect(qacServices.enableLoginPlus).withArgs('non_existent_path').to.throwException(/users database not found/);
            done();
        });
        it('addParam', function(done) {
            var elems = [];
            qacServices.addParam(elems, 'elem1', 'name1');
            var result = [html.input({type:'hidden', name:'name1', value:'elem1'})];
            expect(elems).to.eql(result);
            qacServices.addParam(elems, null, 'name1');
            expect(elems).to.eql(result);
            result.push(html.input({type:'hidden', name:'name2', value:'elem2'}));
            qacServices.addParam(elems, 'elem2', 'name2');
            expect(elems).to.eql(result);
            done();
        });
    });
    describe('session', function() {
        it('setSession', function(done) {
            var ses = {};
            expect(qacServices.setSession(null)).to.eql(ses);
            var req = {};
            expect(qacServices.setSession(req)).to.eql(ses);
            req['cookies'] = null;
            expect(qacServices.setSession(req)).to.eql(ses);
            req['cookies'] = {};
            expect(qacServices.setSession(req)).to.eql(ses);
            var cKey = 'connect.sid';
            req['cookies'][cKey] = null;
            expect(qacServices.setSession(req)).to.eql(ses);
            var cVal = 'un-sid';
            req['cookies'][cKey] = cVal;
            expect(qacServices.setSession(req)).to.eql(ses);
            req['session'] = {};
            expect(qacServices.setSession(req)).to.eql(ses);
            req['session']['passport'] = {}
            expect(qacServices.setSession(req)).to.eql(ses);
            req['session']['passport']['user'] = null;
            expect(qacServices.setSession(req)).to.eql(ses);
            var cUser = 'un-user';
            req['session']['passport']['user'] = cUser;
            ses[cVal] = cUser;
            expect(qacServices.setSession(req)).to.eql(ses);
            
            qacServices.users = qacServices.setSession(req);
            expect(qacServices.users).to.eql(ses);
            cVal = 'otro-sid';
            cUser = 'otro-user';
            ses[cVal] = cUser;
            req['session']['passport']['user'] = cUser;
            req['cookies'][cKey] = cVal;
            qacServices.users = qacServices.setSession(req);
            expect(qacServices.users).to.eql(ses);
            
            qacServices.users = null; // reseteo
            done();
        });
        it('test (fake session)', function(done) {
            expect(qacServices.setSession(helper.session.req)).to.eql(helper.session.users);
            done();
        });
        it('validSession', function(done) {
            qacServices.users = qacServices.setSession(helper.session.req);
            expect(qacServices.users).to.eql(helper.session.users);
            expect(qacServices.validSession(null)).to.eql(null);
            var req = {};
            expect(qacServices.validSession(req)).to.eql(null);
            req['cookies']={'connect.sid':''};
            expect(qacServices.validSession(req)).to.not.be.ok();
            req['cookies']={'connect.sid':'wrong-user'};
            expect(qacServices.validSession(req)).to.not.be.ok();
            req['cookies']={'connect.sid':'fake-sid'};
            expect(qacServices.validSession(req)).to.be.ok();
            qacServices.users = null; // reseteo
            done();
        });
    });
});
