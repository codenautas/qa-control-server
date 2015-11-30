"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var expect = require('expect.js');
var sinon = require('sinon');
var Promises = require('best-promise');
var qacServices = require('../lib/qac-services.js');
var fs = require('fs-promise');
var request = require('supertest');
var helper=require('../test/test-helper.js');
var html = require('js-to-html').html;
var Path = require('path');
helper.setup(qacServices);

describe("qac-services overview",function(){
    it("get cucardasToHtmlList",function(){
        var obt=qacServices.cucardasToHtmlList(
            "[![npm-version](https://img.shields.io/npm/v/multilang.svg)](https://npmjs.org/package/multilang)  \n\r "+
            "[![downloads](https://img.shields.io/npm/dm/multilang.svg)](https://npmjs.org/package/multilangx) "+
            "![extending](https://img.shields.io/badge/stability-extending-orange.svg)"+
            "![stable](https://img.shields.io/badge/stability-stable-green.svg)"
        );
        expect(obt).to.eql([
            html.td([
                html.img({src:"https://img.shields.io/badge/stability-extending-orange.svg", alt:"extending"}),
                html.img({src:"https://img.shields.io/badge/stability-stable-green.svg", alt:"stable"}),
            ]),
            html.td([
                html.a(
                    {href:"https://npmjs.org/package/multilang"}, 
                    [ html.img({src:"https://img.shields.io/npm/v/multilang.svg", alt:"npm-version"}) ]
                ),
            ]),
            html.td([
                html.a(
                    {href:"https://npmjs.org/package/multilangx"}, 
                    [ html.img({src:"https://img.shields.io/npm/dm/multilang.svg", alt:"downloads"}) ]
                ),
            ]),
            html.td(),
            html.td(),
            html.td(),
            html.td(),
            html.td(),
            html.td(),
            html.td(),
        ]);
    });
    it("get projectNameToHtmlLink",function(){
        var oriUrl = qacServices.rootUrl;
        qacServices.rootUrl='/root/'
        var obt=qacServices.projectNameToHtmlLink('simple-org','proj-name');
        expect(obt).to.eql(
            html.a({href:"/root/simple-org/proj-name"}, "proj-name")
        );
        qacServices.rootUrl = oriUrl;
    });
    it("get projectActionButtons",function(){
        var oriUrl = qacServices.rootUrl;
        qacServices.rootUrl='/root/';
        qacServices.user='user-name';
        qacServices.production=false;
        var obt=qacServices.projectActionButtons('simple-org',{projectName:'proj-name'});
        expect(obt).to.eql([
            html.td([
                html.a({
                    href: '/root/ask/delete/simple-org/proj-name',
                    'codenautas-confirm': 'row'
                },[html.img({src:'/delete.png', alg:'del', style:'height:18px'})])
            ]),
            html.td([
                html.a({
                    href:'/root/manual-push/simple-org/proj-name'
                }, [html.img({src:'/refresh.png', alt:'rfrsh', style:'height:18px'})])
            ])
        ]);
        qacServices.production=true;
        qacServices.user=false;
        qacServices.rootUrl = oriUrl;
    });
    describe('getOrganization',function() {
        function checkGetOrg(msg, result, userLogged) {
            it(msg, function(done) {
                sinon.stub(qacServices, "getInfo", function(organization, project){
                    if(!!project){
                        throw new Error("unexpected project name in getInfo");
                    }
                    if(organization!=='simple'){
                        throw new Error("wrong organization name in getInfo");
                    }
                    return Promises.resolve({
                        organization:{
                            projects:[{
                                projectName:'uno'
                            },{
                                projectName:'dos'
                            }],
                            path:'the-org-path'
                        }
                    });
                });
                sinon.stub(fs, 'readFile', function(nameCucardas){
                    //console.log("nameCucardas", nameCucardas);
                    switch(nameCucardas){
                        case Path.normalize('the-org-path/projects/uno/result/cucardas.md'): return Promises.resolve('[qa-control] cu-uno');
                        case Path.normalize('the-org-path/projects/dos/result/cucardas.md'): return Promises.resolve('[qa-control] cu-dos');
                        default: throw new Error('unexpected params in readFile of cucardas');
                    }
                });
                sinon.stub(qacServices, "cucardasToHtmlList", function(x){
                    return [html.td("list: "+x)];
                });
                sinon.stub(qacServices, "projectActionButtons", function(orga, proj){
                    return [html.td("b:"+orga+':'+proj)];
                });
                sinon.stub(qacServices, "projectNameToHtmlLink", function(orga, proj){
                    return "link: "+orga+','+proj;
                });
                if(userLogged) {
                    qacServices.user = 'pepe';
                }
                qacServices.getOrganizationPage('simple').then(function(oHtml){
                    //console.log(oHtml.toHtmlText({pretty:true}));
                    expect(oHtml).to.eql(result);
                }).then(function(){
                    qacServices.getInfo.restore();
                    qacServices.cucardasToHtmlList.restore();
                    qacServices.projectNameToHtmlLink.restore();
                    qacServices.projectActionButtons.restore();
                    fs.readFile.restore();
                    qacServices.user = null;
                }).then(done,done);
            });
        }
        checkGetOrg('simple organization page', html.table([
            html.tr([ html.th('project'), html.th({colspan:10},'cucardas') ]),
            html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control] cu-uno"]), html.td("b:simple:uno") ]),
            html.tr([ html.td("link: simple,dos"), html.td( ["list: [qa-control] cu-dos"]), html.td("b:simple:dos") ]),
        ]));
        checkGetOrg('simple organization page authenticated',
            html.form({method:'post'},
                [html.table([
                    html.tr([ html.th('project'), html.th({colspan:10},'cucardas'), html.th('actions') ]),
                    html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control] cu-uno"]), html.td("b:simple:uno") ]),
                    html.tr([ html.td("link: simple,dos"), html.td( ["list: [qa-control] cu-dos"]), html.td("b:simple:dos") ]),
                ])]
            ), 
            true
        );
    });
    it.skip('make the overview', function(done) {
        var content;
        qacServices.makeOverviewMd('sourcetravelers').then(function(contentMd) {
            content = contentMd;
            return fs.readFile(helper.testConfig.repository.path+'/expected/resume-sourcetravelers.md', {encoding:'utf8'});
        }).then(function(expectedContent) {
            expect(content).to.be(expectedContent);
        }).then(done,done);
    });
    it("obtain html",function(done){
        var htmlContent = "random 123123123123 html content";
        var mock = sinon.stub(qacServices, 'makeOverviewHtml');
        mock.withArgs('sourcetravelers').returns(Promises.resolve(htmlContent));
        var server = createServer();
        var agent=request(server);
        agent
        .get('/sourcetravelers')
        .expect(htmlContent)
        .end(done);
    });
});

var express = require('express');

function createServer(opts, fn) {
    helper.setup(qacServices);
    var _serve = qacServices.overviewServe();
    var app = express();
    app.listen();
    app.use(_serve);
    return app;
}
