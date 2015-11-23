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

helper.setup(qacServices);

describe("qac-services overview",function(){
    it('make the overview', function(done) {
        var content;
        qacServices.makeOverviewMd('sourcetravelers').then(function(contentMd) {
            content = contentMd;
            return fs.readFile(helper.testConfig.repository.path+'/expected/resume-sourcetravelers.md', {encoding:'utf8'});
        }).then(function(expectedContent) {
            expect(content).to.be(expectedContent);
        }).then(done,done);
    });
	it.skip("get cucardasToHtmlList",function(){
		var obt=qacServices.cucardasToHtmlList(
			"[![npm-version](https://img.shields.io/npm/v/multilang.svg)](https://npmjs.org/package/multilang)  \n\r "+
			"[![downloads](https://img.shields.io/npm/dm/multilang.svg)](https://npmjs.org/package/multilangx)"
		);
		expect(obt).to.eql([
			html.a(
				{href:"https://npmjs.org/package/multilang"}, 
				[ html.img({src:"https://img.shields.io/npm/v/multilang.svg", title:"npm-version"}) ]
			),
			html.a(
				{href:"https://npmjs.org/package/multilangx"}, 
				[ html.img({src:"https://img.shields.io/npm/dm/multilang.svg", title:"downloads"}) ]
			)
		]);
	});
	it.skip("get projectNameToHtmlLink",function(){
		qacServices.rootUrl='/root/'
		var obt=qacServices.projectNameToHtmlLink('simple-org','proj-name');
		expect(obt).to.eql(
			html.a({href:"/root/simple-org/proj-name"}, "proj-name")
		);
	});
    it.skip('getOrganization simple organization', function(done) {
		sinon.stub(qacServices, "getInfo", function(organization, project){
			if(!!project){
				throw new Error("unexpected project name in getInfo");
			}
			if(organization!=='simple'){
				throw new Error("wrong organization name in getInfo");
			}
			return {
				organization:{
					projects:[{
						projectName:'uno'
					},{
						projectName:'dos'
					}],
					path:'the-org-path'
				}
			};
		});
		sinon.stub(fs, 'readFile', function(nameCucardas){
			switch(nameCucardas){
			case 'the-org-path/projects/uno/result/cucardas.md': return 'cu-uno';
			case 'the-org-path/projects/dos/result/cucardas.md': return 'cu-dos';
			default: throw new Error('unexpected params in readFile of cucardas');
			}
		});
		sinon.stub(qacServices, "cucardasToHtmlList", function(x){
			return ["list: "+x];
		});
		sinon.stub(qacServices, "projectNameToHtmlLink", function(orga, proj){
			return "link: "+orga+','+proj;
		});
        qacServices.getOrganizationPage('simple').then(function(oHtml){
            expect(oHtml).to.be(
				html.table([
					html.tr([ html.th('project'), html.th('cucardas') ]),
					html.tr([ html.td("link: simple,uno"), html.td( ["list: cu-uno"]) ]),
					html.tr([ html.td("link: simple,dos"), html.td( ["list: cu-dos"]) ]),
				])
			);
		}).then(function(){
			qacServices.getInfo.restore();
			qacServices.cucardasToHtmlList.restore();
			qacServices.projectNameToHtmlLink.restore();
			fs.readFile.restore();
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
