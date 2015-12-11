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
var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
var qcsCommon = require('../lib/qcs-common.js');
var Path = require('path');
var html = require('js-to-html').html;

var bigTimeout=40000;

describe("qac-services",function(){
    var server;
    before(function(){
        helper.setup(qacServices);
    });
    // atencion: todos estos van antes de "push"
    describe("info", function() {
        var org = 'codenautas', prj='multilang';
        function generateExpected(title, extraCSS) {
            var head = qcsCommon.simpleHead(extraCSS);
            var cont = html.table([
                html.tr([
                    html.th('project'),
                    html.th({colspan:10}, 'cucardas')
                ]),
                html.tr([
                    html.td([html.a({href:'/'+org+'/'+prj}, prj)]),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'}),
                    html.td({class:'centrado'},[
                        html.a({href:'https://github.com/'+org+'/'+prj+'/issues'}, [
                            html.img({src:'https://img.shields.io/github/issues-raw/'+org+'/'+prj+'.svg', alt:'issues'})
                        ])
                    ]),
                    html.td({class:'centrado'},[
                        html.a({href:'/'+org+'/'+prj}, [
                            html.img({src:'/'+org+'/'+prj+'.svg', alt:'qa-control'})
                        ])
                    ]),
                    html.td({class:'centrado'})
                ])
            ]);
            var esp=html.html(
                [head, cont]
            );
            var r = esp.toHtmlDoc({pretty:true, title:title});            
            // console.log("espected", r);
            return r;
        };
        it("organizations",function(done){
            server = createServer(qacServices.organizationServe());
            this.timeout(bigTimeout);
            var agent=request(server);
            agent
                .get('/'+org)
                .expect(generateExpected(org+' qa-control'))
                // .expect(function(res) {
                    // expect(res.text).to.eql(generateExpected(org+' qa-control'))
                // })
                .end(function(err, res){
                    // console.log("res", res.text);
                    if(err){ return done(err); }
                    done();
                });
        });
        it("projects",function(done){
            server = createServer(qacServices.projectServe());
            this.timeout(bigTimeout);
            var agent=request(server);
            agent
                .get('/'+org+'/'+prj)
                .expect(generateExpected(org+' - '+prj+' qa-control', qacServices.rootUrl+'result.css'))
                .end(function(err, res){
                    // console.log("res", res.text);
                    if(err){ return done(err); }
                    done();
                });
        });
    });
    describe("push", function() {
        var json; // payload pasado a json
        var headers;
        var json2, headers2;
        before(function() {
            server = createServer(qacServices.receivePush());
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
        };
        it("receive the first push",function(done){
            this.timeout(bigTimeout);
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
        it("receive the second push",function(done){
            this.timeout(bigTimeout);
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

function createServer(_serve) {
    helper.setup(qacServices);
    var app = express();
    app.listen();
    app.use(_serve);
    return app;
}
