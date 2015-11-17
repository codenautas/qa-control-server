"use strict";
var expect = require('expect.js');
var Promises = require('best-promise');
var qacServices = require('../lib/qac-services.js');
var helper=require('../test/test-helper.js');
var _ = require('lodash');

describe('qac-services modification functions', function(){
    helper.setup(qacServices);
    describe('organization/project actions', function() {
        function orgWrongInput(msg, p1, expRE) {
            it('createOrganization should fail with '+msg, function(done) {
                return qacServices.createOrganization(p1).then(function(rv) {
                    throw new Error('should fail');
                },function(err){
                    expect(err.message).to.match(expRE);
                }).then(done,done);
            });
        }
        orgWrongInput('missing name', null, /missing organization name/);
        orgWrongInput('existing organization', 'sourcetravelers', /cannot create existing organization/);
        orgWrongInput('with bad name', 'organization with wrong name', /invalid organization name/);
        orgWrongInput('another bad name', '3starts-with-number', /invalid organization name/);
        var organization='org-with-slashes';
        var project='proj1', project2='proj2';
        it('should create organization (#7)', function(done) {
            return qacServices.createOrganization(organization).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('organization "'+organization+'" created');
                return qacServices.getInfo(organization);
            }).then(function(info) {
                //console.log(info);
                expect(info.organization.name).to.eql(organization);
                expect(info.organization.projects).to.eql([]);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        function projWrongInput(msg, org, proj, expRE) {
            it('createProject should fail with '+msg, function(done) {
                return qacServices.createProject(org, proj).then(function(rv) {
                    //console.log("no fallo", rv);
                    throw new Error('should fail');
                },function(err){
                    //console.log("SI FALLO", err.stack);
                    expect(err.message).to.match(expRE);
                }).then(done,done);
            });     
        }
        projWrongInput('missing organization', null, null, /missing organization name/);
        projWrongInput('missing organization with project', null, project, /missing organization name/);
        projWrongInput('missing project', organization, null, /missing project name/);
        projWrongInput('bad organization name', 'wrong organization', project, /invalid organization name/);
        projWrongInput('bad project name', organization, 'bad project', /invalid project name/);
        it('should create project (#8)', function(done) {
            return qacServices.createProject(organization, project).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('project "'+project+'" created');
                return qacServices.getInfo(organization, project);
            }).then(function(info) {
                //console.log(info);
                expect(info.organization.name).to.eql(organization);
                expect(info.organization.projects).to.eql([{'projectName':project}]);
                expect(info.project.name).to.eql(project);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        it('should remove project', function(done) {
            return qacServices.deleteData(organization, project).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('project "'+project+'" removed');
                return qacServices.getInfo(organization);
            }).then(function(info) {
                //console.log(info);
                expect(info.organization.projects).to.eql([]);
                done();
            }, function(err) {
                done(err);
            });
        });
        it('should remove organization', function(done) {
            return qacServices.deleteData(organization).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('organization "'+organization+'" removed');
                return qacServices.getInfo(organization);
            }).then(function(info) {
                //console.log(info);
                done('should fail');
            }, function(err) {
                expect(err.message).to.match(/inexistent organization/)
                done();
            });
        });
    });
 });