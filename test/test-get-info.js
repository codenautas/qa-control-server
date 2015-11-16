"use strict";
var expect = require('expect.js');
var Promises = require('best-promise');
//var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
//var Path = require('path');
var helper=require('../test/test-helper.js');
var _ = require('lodash');

describe('qac-services functions', function(){
    helper.setup(qacServices);
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
        testBadInput('missing parameters', null, null, /missing organization/);
        testBadInput('missing organization', 'non-existent-organization', null, /inexistent organization/);
        testBadInput('missing project', 'sourcetravelers', {project:'not-an-app'}, /inexistent project/);
        var organization='sourcetravelers';
        var project='the-app', project2='other-app';
        it('should return organization info', function(done) {
            return qacServices.getInfo(organization).then(function(info) {
                expect(info.organization.name).to.be(organization);
                expect(info.organization.path).to.match(new RegExp(organization));
                //console.log("info", info.organization.projects);
                expect(info.organization.projects).to.eql([{projectName:project2}, {projectName:project}]);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        it('should return project info', function(done) {
            return qacServices.getInfo(organization, {project:project}).then(function(info) {
                expect(info.organization.name).to.be(organization);
                expect(info.organization.path).to.match(new RegExp(organization));
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
                expect(info.organization.name).to.be(anotherGroup);
                expect(info.organization.path).to.match(new RegExp(anotherGroup));
                expect(info.project.name).to.be(nonExistentProject);
                expect(info.project.path).to.match(new RegExp(nonExistentProject));
                //console.log("info", info);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    });
    describe('getOrganizations', function() {
        helper.setup(qacServices);
        it('should fail on inexistent repository path', function(done) {
            var oriPath = _.clone(qacServices.repository.path);
            qacServices.repository.path = '/non/existent/path/';
            return qacServices.getOrganizations().then(function(orgs) {
                throw new Error('should fail');
            },function(err){
                expect(err.message).to.match(/inexistent repository/);
            }).then(done,done).then(function() {
                qacServices.repository.path = oriPath;
            });
        });
        it('should return the list of organizations', function(done) {
            return qacServices.getOrganizations().then(function(orgs) {
               expect(orgs).to.eql(['anothergroup','codenautas','neworg', 'sourcetravelers']);
               //console.log("orgs", orgs);
               done(); 
            }).catch(function(err) {
                done(err);
            });
        });
    });
 });