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
var helper=require('../test/test-helper.js');
var html = require('js-to-html').html;
var Path = require('path');
helper.setup(qacServices);

describe("qac-services resume",function(){
    it("get cucardasToHtmlList",function(){
        var obt=qacServices.cucardasToHtmlList(
            "[![npm-version](https://img.shields.io/npm/v/multilang.svg)](https://npmjs.org/package/multilang)  \n\r "+
            "[![downloads](https://img.shields.io/npm/dm/multilang.svg)](https://npmjs.org/package/multilangx) "+
            "![extending](https://img.shields.io/badge/stability-extending-orange.svg)"+
            "![stable](https://img.shields.io/badge/stability-stable-green.svg)"+
            "![otra](https://img.shields.io/badge/stability-otra-green.svg)"+
            "![otra-mas](https://img.shields.io/badge/stability-otra-mas-green.svg)"
        );
        //console.log("obt", obt);
        expect(obt).to.eql([
            html.td({"class": 'centrado'}, [
                html.img({src:"https://img.shields.io/badge/stability-extending-orange.svg", alt:"extending"}),
                html.img({src:"https://img.shields.io/badge/stability-stable-green.svg", alt:"stable"})
            ]),
            html.td({"class": 'centrado'}, [
                html.a(
                    {href:"https://npmjs.org/package/multilang"}, 
                    [ html.img({src:"https://img.shields.io/npm/v/multilang.svg", alt:"npm-version"}) ]
                ),
            ]),
            html.td({"class": 'centrado'}, [
                html.a(
                    {href:"https://npmjs.org/package/multilangx"}, 
                    [ html.img({src:"https://img.shields.io/npm/dm/multilang.svg", alt:"downloads"}) ]
                ),
            ]),
            html.td({"class": 'centrado'}),
            html.td({"class": 'centrado'}),
            html.td({"class": 'centrado'}),
            html.td({"class": 'centrado'}),
            html.td({"class": 'centrado'}),
            html.td({"class": 'centrado'}),
            html.td({"class": 'centrado'}),
            html.td({"class": 'centrado'}, [
                html.img({src:"https://img.shields.io/badge/stability-otra-green.svg", alt:"otra"}),
                html.img({src:"https://img.shields.io/badge/stability-otra-mas-green.svg", alt:"otra-mas"})
            ])
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
        var ses = helper.session.req;
        qacServices.users = qacServices.setSession(ses);
        qacServices.production=false;
        var obt=qacServices.projectActionButtons(ses, 'simple-org','proj-name');
        expect(obt).to.eql([
            html.td([
                html.a({
                    href: '/root/ask/delete/simple-org/proj-name',
                    'codenautas-confirm': 'row'
                },[html.img({src:'/root/delete.png', alt:'del', style:'height:18px'})])
            ]),
            html.td([
                html.a({
                    href:'/root/refresh/simple-org/proj-name'
                }, [html.img({src:'/root/refresh.png', alt:'rfrsh', style:'height:18px'})])
            ])
        ]);
        qacServices.production=true;
        qacServices.users=false;
        qacServices.rootUrl = oriUrl;
    });
    describe('organization page',function() {
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
                            path:'the-org-path',
                            name:organization
                        }
                    });
                });
                sinon.stub(fs, 'readFile', function(nameCucardas){
                    //console.log("nameCucardas", nameCucardas);
                    switch(nameCucardas){
                        case Path.normalize('the-org-path/projects/uno/result/cucardas.md'): return Promises.resolve('[qa-control][issues] cu-uno');
                        case Path.normalize('the-org-path/projects/dos/result/cucardas.md'): return Promises.resolve('[qa-control][issues] cu-dos');
                        default: throw new Error('unexpected params in readFile of cucardas');
                    }
                });
                sinon.stub(qacServices, "cucardasToHtmlList", function(x){
                    return [html.td("list: "+x)];
                });
                var ses = null;
                if(userLogged) {
                    ses = helper.session.req;
                    qacServices.users = qacServices.setSession(ses);
                }
                sinon.stub(qacServices, "projectActionButtons", function(ses, orga, proj){
                    return [html.td("b:"+orga+':'+proj)];
                });
                sinon.stub(qacServices, "projectNameToHtmlLink", function(orga, proj){
                    return "link: "+orga+','+proj;
                });
                sinon.stub(qacServices, "sortProjects", function(proj1, proj2) {
                   if(proj1 < proj2) {
                       return -1;
                   } else if(proj1 > proj2) {
                       return 1;
                   }
                   return 0;
                });
                qacServices.getOrganizationPage(ses, 'simple').then(function(oHtml){
                    //console.log(oHtml.toHtmlText({pretty:true}));
                    expect(oHtml).to.eql(result);
                }).then(function(){
                    qacServices.getInfo.restore();
                    qacServices.cucardasToHtmlList.restore();
                    qacServices.projectNameToHtmlLink.restore();
                    qacServices.projectActionButtons.restore();
                    qacServices.sortProjects.restore();
                    fs.readFile.restore();
                    qacServices.users = null;
                }).then(done,done);
            });
        }
        checkGetOrg('simple organization page', html.table([
            html.tr([ html.th('project'), html.th({colspan:10},'cucardas') ]),
            html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control][issues] cu-uno"]), html.td("b:simple:uno") ]),
            html.tr([ html.td("link: simple,dos"), html.td( ["list: [qa-control][issues] cu-dos"]), html.td("b:simple:dos") ])
        ]));
        checkGetOrg('simple organization page authenticated',
            html.form({method:'post', action:qacServices.rootUrl},
                [html.table([
                    html.tr([ html.th('project'), html.th({colspan:10},'cucardas'), html.th({colspan:4},'actions') ]),
                    html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control][issues] cu-uno"]), html.td("b:simple:uno") ]),
                    html.tr([ html.td("link: simple,dos"), html.td( ["list: [qa-control][issues] cu-dos"]), html.td("b:simple:dos") ]),
                    html.tr([ html.td({colspan:16, "class":'right-align'}, [
                                html.input({type:'hidden', name:'action', value:'add'}),
                                html.input({type:'hidden', name:'organization', value:'simple'}),
                                html.input({type:'text', name:'project'}),
                                html.input({type:'submit', value:'New project...' })
                                ])
                            ])
                ])]
            ), 
            true
        );
        it('emtpy organization page', function(done) {
            qacServices.getOrganizationPage(null, 'emptygroup').then(function(oHtml){
                var result = html.table([
            html.tr([ html.td('emptygroup has no projects') ])]);
                expect(oHtml).to.eql(result);
            }).then(done,done);
        });
        it('emtpy organization page authenticated', function(done) {
            var ses = helper.session.req;
            qacServices.users = qacServices.setSession(ses);
            qacServices.getOrganizationPage(ses, 'emptygroup').then(function(oHtml){
                var result = html.form({method:'post', action:qacServices.rootUrl},
                [html.table([
                    html.tr([ html.td([
                                html.input({type:'hidden', name:'action', value:'add'}),
                                html.input({type:'hidden', name:'organization', value:'emptygroup'}),
                                html.input({type:'text', name:'project'}),
                                html.input({type:'submit', value:'New project...' })
                                ])
                            ])
                ])]
            );
                expect(oHtml).to.eql(result);
            }).then(function() {
                qacServices.users = null;
            }).then(done,done);
        });
    });
    describe('project page',function() {
        function checkGetProj(msg, result, userLogged, logHow) {
            it(msg, function(done) {
                sinon.stub(qacServices, "getInfo", function(organization, project){
                    if(project !=='uno'){
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
                            path:'the-org-path',
                            name:organization
                        },
                        project:{
                            path:'the-proj-path',
                            name:project
                        }
                    });
                });
                sinon.stub(fs, 'readFile', function(nameCucardas){
                    //console.log("nameCucardas", nameCucardas);
                    switch(nameCucardas){
                        case Path.normalize('the-org-path/projects/uno/result/cucardas.md'): return Promises.resolve('[qa-control][issues] cu-uno');
                        default: throw new Error('unexpected params in readFile of cucardas');
                    }
                });
                sinon.stub(qacServices, "cucardasToHtmlList", function(x){
                    return [html.td("list: "+x)];
                });
                var req = null;
                if(userLogged) {
                    req = helper.session.req;
                    qacServices.users = qacServices.setSession(req);
                }
                sinon.stub(qacServices, "projectActionButtons", function(req, orga, proj){
                    return [html.td("b:"+orga+':'+proj)];
                });
                sinon.stub(qacServices, "projectNameToHtmlLink", function(orga, proj){
                    return "link: "+orga+','+proj;
                });
                sinon.stub(qacServices, "getProjectLogs", function(path) {
                    if(! logHow) { return ['qac-logs', 'bitacora-logs']; }
                    if(logHow == 'empty') { return []; }
                    return Promises.reject('getProjectLogs() has failed'); 
                });
                qacServices.getProjectPage(req, 'simple', 'uno').catch(function(err) {
                    if(logHow && logHow !== 'empty') {
                        expect(err).to.eql('getProjectLogs() has failed');
                        return result;
                    }
                }).then(function(oHtml){
                    //console.log(oHtml.toHtmlText({pretty:true}));
                    expect(oHtml).to.eql(result);
                }).then(function(){
                    qacServices.getInfo.restore();
                    qacServices.cucardasToHtmlList.restore();
                    qacServices.projectNameToHtmlLink.restore();
                    qacServices.projectActionButtons.restore();
                    qacServices.getProjectLogs.restore();
                    fs.readFile.restore();
                    qacServices.users = null;
                    done();
                });
            });
        }
        var simpleRes = html.table([
                html.tr([ html.th('project'), html.th({colspan:10},'cucardas') ]),
                html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control][issues] cu-uno"]), html.td("b:simple:uno") ])
            ]);
        checkGetProj('simple project page', html.body([simpleRes, 'qac-logs','bitacora-logs']));
        checkGetProj('simple project page authenticated', html.body([
            html.form({method:'post', action:qacServices.rootUrl},
                    [html.table(
                        [
                            html.tr([ html.th('project'), html.th({colspan:10},'cucardas'), html.th({colspan:4},'actions') ]),
                            html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control][issues] cu-uno"]), html.td("b:simple:uno") ])
                        ])
                    ]),'qac-logs','bitacora-logs']), 
            true
        );
        checkGetProj('simple project page without logs', html.body([simpleRes]), false, 'empty');
        checkGetProj('simple project page failing', undefined, false, true);
    });
    describe('getAdmin',function() {
        function checkGetAdmin(msg, result, userLogged, returnNoOrgs) {
            it(msg, function(done) {
                sinon.stub(qacServices, "getOrganizations", function(){ return Promises.resolve(returnNoOrgs ? [] : ['uno', 'dos']); });
                var req = null;
                if(userLogged) {
                    req = helper.session.req;
                    qacServices.users = qacServices.setSession(req);
                }
                qacServices.getAdminPage(req).then(function(oHtml){
                    // console.log(oHtml.toHtmlText({pretty:true}));
                    // console.log(result.toHtmlText({pretty:true}));
                    expect(oHtml).to.eql(result);
                }).then(function(){
                    qacServices.getOrganizations.restore();
                    qacServices.users = null;
                }).then(done,done);
            });
        }
        checkGetAdmin('simple admin page', 
            html.table([
                html.tr([html.th('organization')]),
                html.tr([html.td([html.a({href:'/uno'}, 'uno')])]),
                html.tr([html.td([html.a({href:'/dos'}, 'dos')])])
            ])
        );
        checkGetAdmin('simple admin page authenticated', 
            html.form({method:'post', action:qacServices.rootUrl},[
                html.table([
                    html.tr([html.th('organization'), html.th('actions')]),
                    html.tr([
                        html.td([html.a({href:'/uno'}, 'uno')]),
                        html.td({"class": 'centrado'}, [
                            html.a(
                                {href:'/ask/delete/uno', 'codenautas-confirm':'row'},
                                [html.img({src:'/delete.png', alt:'del', style:'height:18px'})]
                            )
                        ])
                    ]),
                    html.tr([
                        html.td([html.a({href:'/dos'}, 'dos')]),
                        html.td({"class": 'centrado'}, [
                            html.a(
                                {href:'/ask/delete/dos', 'codenautas-confirm':'row'},
                                [html.img({src:'/delete.png', alt:'del', style:'height:18px'})]
                            )
                        ])
                    ]),
                    html.tr([
                        html.td({colspan:2, "class":'right-align'},[
                            html.input({type:'hidden', name:'action', value:'create'}),
                            html.input({type:'text', name:'organization'}),
                            html.input({type:'submit', value:'New organization...'})
                        ])
                    ])
                ])
            ]),
            true
        );
        checkGetAdmin('simple admin with no organizaions', 
            html.table([
                html.tr([html.td('There are no organizations')])
            ]), 
            false, 
            true
        );
    });
});
