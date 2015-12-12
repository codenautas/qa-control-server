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

describe("qac-services overview",function(){
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
            html.td({class:'centrado'}, [
                html.img({src:"https://img.shields.io/badge/stability-extending-orange.svg", alt:"extending"}),
                html.img({src:"https://img.shields.io/badge/stability-stable-green.svg", alt:"stable"})
            ]),
            html.td({class:'centrado'}, [
                html.a(
                    {href:"https://npmjs.org/package/multilang"}, 
                    [ html.img({src:"https://img.shields.io/npm/v/multilang.svg", alt:"npm-version"}) ]
                ),
            ]),
            html.td({class:'centrado'}, [
                html.a(
                    {href:"https://npmjs.org/package/multilangx"}, 
                    [ html.img({src:"https://img.shields.io/npm/dm/multilang.svg", alt:"downloads"}) ]
                ),
            ]),
            html.td({class:'centrado'}),
            html.td({class:'centrado'}),
            html.td({class:'centrado'}),
            html.td({class:'centrado'}),
            html.td({class:'centrado'}),
            html.td({class:'centrado'}),
            html.td({class:'centrado'}),
            html.td({class:'centrado'}, [
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
        qacServices.user='user-name';
        qacServices.production=false;
        var obt=qacServices.projectActionButtons('simple-org','proj-name');
        expect(obt).to.eql([
            html.td([
                html.a({
                    href: '/root/ask/delete/simple-org/proj-name',
                    'codenautas-confirm': 'row'
                },[html.img({src:'/root/delete.png', alt:'del', style:'height:18px'})])
            ]),
            html.td([
                html.a({
                    href:'/root/manual-push/simple-org/proj-name'
                }, [html.img({src:'/root/refresh.png', alt:'rfrsh', style:'height:18px'})])
            ])
        ]);
        qacServices.production=true;
        qacServices.user=false;
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
                sinon.stub(qacServices, "projectActionButtons", function(orga, proj){
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
                    qacServices.sortProjects.restore();
                    fs.readFile.restore();
                    qacServices.user = null;
                }).then(done,done);
            });
        }
        checkGetOrg('simple organization page', html.table([
            html.tr([ html.th('project'), html.th({colspan:10},'cucardas') ]),
            html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control][issues] cu-uno"]), html.td("b:simple:uno") ]),
            html.tr([ html.td("link: simple,dos"), html.td( ["list: [qa-control][issues] cu-dos"]), html.td("b:simple:dos") ]),
        ]));
        checkGetOrg('simple organization page authenticated',
            html.form({method:'post', action:qacServices.rootUrl},
                [html.table([
                    html.tr([ html.th('project'), html.th({colspan:10},'cucardas'), html.th({colspan:4},'actions') ]),
                    html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control][issues] cu-uno"]), html.td("b:simple:uno") ]),
                    html.tr([ html.td("link: simple,dos"), html.td( ["list: [qa-control][issues] cu-dos"]), html.td("b:simple:dos") ]),
                    html.tr([ html.td({colspan:16, align:'right'}, [
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
    });
    describe('project page',function() {
        function checkGetProj(msg, result, userLogged) {
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
                sinon.stub(qacServices, "projectActionButtons", function(orga, proj){
                    return [html.td("b:"+orga+':'+proj)];
                });
                sinon.stub(qacServices, "projectNameToHtmlLink", function(orga, proj){
                    return "link: "+orga+','+proj;
                });
                sinon.stub(qacServices, "getProjectLogs", function(path) {
                   return ['qac-logs', 'bitacora-logs']; 
                });
                if(userLogged) {
                    qacServices.user = 'pepe';
                }
                qacServices.getProjectPage('simple', 'uno').then(function(oHtml){
                    // console.log(oHtml.toHtmlText({pretty:true}));
                    expect(oHtml).to.eql(result);
                }).then(function(){
                    qacServices.getInfo.restore();
                    qacServices.cucardasToHtmlList.restore();
                    qacServices.projectNameToHtmlLink.restore();
                    qacServices.projectActionButtons.restore();
                    qacServices.getProjectLogs.restore();
                    fs.readFile.restore();
                    qacServices.user = null;
                }).then(done,done);
            });
        }
        checkGetProj('simple project page', html.body([
            html.table([
                html.tr([ html.th('project'), html.th({colspan:10},'cucardas') ]),
                html.tr([ html.td("link: simple,uno"), html.td( ["list: [qa-control][issues] cu-uno"]), html.td("b:simple:uno") ])
            ]), 'qac-logs','bitacora-logs'
        ]));
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
    });
    describe('getAdmin',function() {
        function checkGetAdmin(msg, result, userLogged, returnNoOrgs) {
            it(msg, function(done) {
                sinon.stub(qacServices, "getOrganizations", function(){ return Promises.resolve(returnNoOrgs ? [] : ['uno', 'dos']); });
                if(userLogged) {
                    qacServices.user = 'tito';
                }
                qacServices.getAdminPage().then(function(oHtml){
                    // console.log(oHtml.toHtmlText({pretty:true}));
                    // console.log(result.toHtmlText({pretty:true}));
                    expect(oHtml).to.eql(result);
                }).then(function(){
                    qacServices.getOrganizations.restore();
                    qacServices.user = null;
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
                        html.td({class:'centrado'}, [
                            html.a(
                                {href:'/ask/delete/uno', 'codenautas-confirm':'row'},
                                [html.img({src:'/delete.png', alt:'del', style:'height:18px'})]
                            )
                        ])
                    ]),
                    html.tr([
                        html.td([html.a({href:'/dos'}, 'dos')]),
                        html.td({class:'centrado'}, [
                            html.a(
                                {href:'/ask/delete/dos', 'codenautas-confirm':'row'},
                                [html.img({src:'/delete.png', alt:'del', style:'height:18px'})]
                            )
                        ])
                    ]),
                    html.tr([
                        html.td({colspan:2, align:'right'},[
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
