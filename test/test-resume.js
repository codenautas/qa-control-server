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

qacServices.config(helper.testConfig);

describe("qcs-services overview",function(){
    it("make the overview",function(done){
        qacServices.makeOverviewMd('sourcetravelers').then(function(contentMd){
            return fs.readFile(helper.testConfig.repository+'/expected/resume-sourcetravelers.md', {encoding:'utf8'})
            .then(function(expectedContent){
                expect(contentMd).to.be(expectedContent);
            });
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
    qacServices.config(opts);
    var _serve = qacServices.overviewServe();
    var app = express();
    app.listen();
    app.use(_serve);
    return app;
}
