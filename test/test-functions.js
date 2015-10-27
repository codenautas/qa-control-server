"use strict";

var expect = require('expect.js');
var Promises = require('best-promise');
//var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
//var Path = require('path');
//var helper=require('../test/test-helper.js');

describe('qac-services functions', function(){
    describe('getInfo', function() {
        it('should fail with missing parameters', function(done) {
           return qacServices.getInfo(null, null).then(function(info) {
                done('should fail');
            }).catch(function(err) {
                expect(err.message).to.match(/missing group/);
                done();
            });
        });
        it('should fail with missing group', function(done) {
            return qacServices.getInfo('non-existent-group').then(function(info) {
                done('should fail');
            }).catch(function(err) {
                //console.log("err", err);
                expect(err.message).to.match(/inexistent group/);
                done();
            });
        });
        it('should fail with missing project', function(done) {
           return qacServices.getInfo('sourcetravelers', {project:'not-an-app'}).then(function(info) {
               done('should fail');
           }).catch(function(err) {
               expect(err.message).to.match(/inexistent project/);
               done();
           });
        });
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
    });
});