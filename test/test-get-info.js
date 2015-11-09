"use strict";

var expect = require('expect.js');
var Promises = require('best-promise');
//var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
//var Path = require('path');
var helper=require('../test/test-helper.js');

describe('qac-services functions', function(){
    qacServices.config(helper.testConfig);
    describe('getInfo', function() {
        function testBadInput(msg, p1, p2, expRE) {
            it('should fail with '+msg, function(done) {
                return qacServices.getInfo(p1, p2).then(function(info) {
                    throw new Error('should fail');
                },function(err){
                    expect(err.message).to.match(expRE);
                }).then(done,done);
            });            
        }
        testBadInput('missing parameters', null, null, /missing group/);
        testBadInput('missing group', 'non-existent-group', null, /inexistent group/);
        testBadInput('missing project', 'sourcetravelers', {project:'not-an-app'}, /inexistent project/);
        var group='sourcetravelers';
        var project='the-app', project2='other-app';
        it('should return group info', function(done) {
            return qacServices.getInfo(group).then(function(info) {
                expect(info.group.name).to.be(group);
                expect(info.group.path).to.match(new RegExp(group));
                //console.log("info", info.group.projects);
                expect(info.group.projects).to.eql([{projectName:project2}, {projectName:project}]);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        it('should return project info', function(done) {
            return qacServices.getInfo(group, {project:project}).then(function(info) {
                expect(info.group.name).to.be(group);
                expect(info.group.path).to.match(new RegExp(group));
                expect(info.project.name).to.be(project);
                expect(info.project.path).to.match(new RegExp(project));
                //console.log("info", info);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        it('should create project folder if requested', function(done) {
            var nonExistentProject='prueba';
            var anotherGroup='anothergroup';
            return qacServices.getInfo(anotherGroup, {project:nonExistentProject, createProject:true}).then(function(info) {
                expect(info.group.name).to.be(anotherGroup);
                expect(info.group.path).to.match(new RegExp(anotherGroup));
                expect(info.project.name).to.be(nonExistentProject);
                expect(info.project.path).to.match(new RegExp(nonExistentProject));
                //console.log("info", info);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    });
});