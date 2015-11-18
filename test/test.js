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
var Path = require('path');

describe("qac-services",function(){
    var server;
    var json; // payload pasado a json
    var headers;
    var json2, headers2;
    before(function(){
        server = createServer(helper.testConfig);
        return helper.readSampleWebHook('mlang01').then(function(wh) {
            headers = wh.headers;
            json = JSON.parse(wh.payload);
            return helper.readSampleWebHook('mlang02');
        }).then(function(wh) {
            headers2 = wh.headers;
            json2 = JSON.parse(wh.payload);
        });
    });
    function getProjectInfo(json) {
        return qacServices.getInfo(json.repository.organization, json.repository.name);
    }
    it("receive the first push",function(done){
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
                getProjectInfo(json).then(function(info) {
                    //console.log("info", info);
                    done();
                });
            });
    });
    // OJO este test debe correr siempre despues de "receive the first push"!!!
    it("check that basic files and directories are generated",function(done){
        getProjectInfo(json).then(function(info) {
            return fs.readdir(Path.normalize(info.project.path+'/result'));
        }).then(function(dir) {
            expect(dir.indexOf('cucarda.svg')).not.to.equal(-1);
            expect(dir.indexOf('cucardas.md')).not.to.equal(-1);
            expect(dir.indexOf('qa-control-result.json')).not.to.equal(-1);
            expect(dir.indexOf('bitacora.json')).not.to.equal(-1);
            done(); 
        }).catch(function(err) {
            done(err.message);
        });
    });
    it("check that the correct project.svg can be requested",function(done){
        var agent=request(server);
        agent
            .get('/'+json.repository.organization+'/'+json.repository.name+'.svg')
            .end(function(err, res){
                if(err){ return done(err); }
                getProjectInfo(json).then(function(info) {
                    // console.log("info", info)
                    fs.readFile(Path.normalize(info.project.path+'/result/cucarda.svg'), 'utf8').then(function(svg) {
                        expect(res.text.indexOf(svg)).not.to.equal(-1);
                    })
                    done(); 
                }).catch(function(err) {
                    done(err.message);
                });
            });
    });
    it("receive the second push",function(done){
        this.timeout(40000);
        var agent=request(server);
        agent
            .post('/push/'+json2.repository.organization+'/'+json2.repository.name)
            .set(headers2)
            .type('json')
            .send(json2)
            .expect('ok: '+json2.head_commit.timestamp)
            .end(function(err, res){
                if(err){ return done(err); }
                getProjectInfo(json).then(function(info) {
                    //console.log("info", info);
                    done();
                });
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
