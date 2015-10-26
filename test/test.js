"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */
/* global describe */
/* global it */

var expect = require('expect.js');
var sinon = require('sinon');
var Promises = require('best-promise');
var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');

var request = require('supertest');
var helper=require('../test/test.helper.js');

describe("qa-control",function(){
    var server;
    var json; // payload pasado a json
    var headers;
    before(function(){
        server = createServer(helper.testConfig);
        return helper.readSampleWebHook('push01').then(function(wh) {
            headers = wh.headers;
            json = JSON.parse(wh.payload);
        })
    });
    it("reject receive without X-GitHub-Event",function(done){
        var agent=request(server);
        agent
            .post('/push/'+json.repository.name+'/'+json.repository.organization)
            .type('json')
            .send(json)
            .expect(400)
            .expect('bad request. Missing X-GitHub-Event header')
            .end(done);
    });
    it("receive one push",function(done){
        var agent=request(server);
        agent
            .post('/push/codenautas/'+json.repository.name)
            .set(headers) // esto setea todo!!
            .type('json')
            .send(json)
            .expect('ok: '+json.head_commit.timestamp)
            .end(function(err){
                if(err){ return done(err); }
                //expect(qacServices.getGroup(json.repository.organization).getProject(json.repository.name).info.timestamp)
                //      .to.eql(json.head_commit.timestamp);
                // expect(qaControl.projectControl.toBeCalledOnceUponATime).to.ok();
                done();
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
