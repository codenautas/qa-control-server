"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var request = require('supertest');
var helper=require('../test/test-helper.js');
var _ = require('lodash');
var expect = require('expect.js');
var sinon = require('sinon');
var Promises = require('best-promise');
var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');

describe("qac-services",function(){
    var server;
    var json; // payload pasado a json
    var headers;
    var json2, headers2;
    before(function(){
        server = createServer(helper.testConfig);
        return helper.readSampleWebHook('qcs01').then(function(wh) {
            headers = wh.headers;
            json = JSON.parse(wh.payload);
            return helper.readSampleWebHook('qcs02');
        }).then(function(wh) {
            headers2 = wh.headers;
            json2 = JSON.parse(wh.payload);
        });
    });
    it("receive one push",function(done){
        this.timeout(10000);
        var agent=request(server);
        agent
            .post('/push/'+json.repository.organization+'/'+json.repository.name)
            .set(headers) // esto setea todo!!
            .type('json')
            .send(json)
            .expect('ok: '+json.head_commit.timestamp)
            .end(function(err, res){
                if(err){ return done(err); }
                //expect(qacServices.getGroup(json.repository.organization).getProject(json.repository.name).info.timestamp)
                //      .to.eql(json.head_commit.timestamp);
                // expect(qaControl.projectControl.toBeCalledOnceUponATime).to.ok();
                //console.log("res", res);
                done();
            });
    });
    describe('request', function() {
        it("reject requests without X-GitHub-Event",function(done){
            var agent=request(server);
            agent
                .post('/push/'+json.repository.organization+'/'+json.repository.name)
                .type('json')
                .send(json)
                .expect(400)
                .expect('bad request. Missing X-GitHub-Event header')
                .end(done);
        });
        it("reject requests with x-hub-signature that doesn't validates",function(done){
            var modHeaders = _.clone(headers);
            modHeaders['Content-Length'] = headers2['Content-Length'];
            //console.log("modHeaders", modHeaders);
            var agent=request(server);
            agent
                .post('/push/'+json.repository.organization+'/'+json.repository.name)
                .type('json')
                .set(modHeaders)
                .send(json2)
                .expect(403)
                .expect('unauthorized request. Invalid x-hub-signature')
                .end(done);
        });        
    });
});

var express = require('express');

function createServer(opts, fn) {
    qacServices.config(opts);
    var _serve = qacServices.receivePush();
    var app = express();
    app.listen();
    app.use(_serve);
    return app;
}
