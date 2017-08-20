"use strict";
var expect = require('expect.js');
var fs = require('fs-extra');
var qacServices = require('../lib/qac-services.js');
var helper=require('../test/test-helper.js');
var _ = require('lodash');
var sinon = require('sinon');
       
describe('qac-services modification functions', function(){
    helper.setup(qacServices);
    describe('organization/project actions', function() {
        function orgWrongInput(msg, p1, expRE) {
            it('createOrganization should fail with '+msg, function() {
                return qacServices.createOrganization(p1).then(function(rv) {
                    throw new Error('should fail');
                },function(err){
                    expect(err.message).to.match(expRE);
                });
            });
        }
        orgWrongInput('missing name', null, /missing organization name/);
        orgWrongInput('existing organization', 'sourcetravelers', /cannot create existing organization/);
        orgWrongInput('with bad name', 'organization with wrong name', /invalid organization name/);
        orgWrongInput('another bad name', '3starts-with-number', /invalid organization name/);
        var orgWithSlashes='org-with-slashes';
        var project='proj1', project2='proj2';
        it('should create organization (#7)', function() {
            return qacServices.createOrganization(orgWithSlashes).then(function(status) {
                expect(status).to.eql('organization "'+orgWithSlashes+'" created');
                return qacServices.getInfo(orgWithSlashes);
            }).then(function(info) {
                expect(info.organization.name).to.eql(orgWithSlashes);
                expect(info.organization.projects).to.eql([]);
            });
        });
        function projWrongInput(msg, org, proj, expRE, sinonEOG) {
            it('createProject should fail with '+msg, function() {
                this.timeout(4000);
                if(sinonEOG) {
                    sinon.stub(qacServices, 'existsOnGithub', function(o, p) {
                        if(sinonEOG==orgWithSlashes) {
                            return {orgNotFound:true};
                        } else if(sinonEOG==project) {
                            return {projNotFound:true};
                        }
                        return {};
                    });
                }
                return qacServices.createProject(org, proj).then(function(rv) {
                    throw new Error('should fail');
                },function(err){
                    if(sinonEOG) { qacServices.existsOnGithub.restore(); }
                    expect(err.message).to.match(expRE);
                });
            });     
        }
        projWrongInput('missing organization', null, null, /missing organization name/);
        projWrongInput('missing organization with project', null, project, /missing organization name/);
        projWrongInput('missing project', orgWithSlashes, null, /missing project name/);
        projWrongInput('bad organization name', 'wrong organization', project, /invalid organization name/);
        projWrongInput('bad project name', orgWithSlashes, 'bad project', /invalid project name/);
        projWrongInput('organization error on github', orgWithSlashes, project, /inexistent organization on github/, orgWithSlashes);
        projWrongInput('project error on github', orgWithSlashes, project, /inexistent project on github/, project);
        /*
          Tests deshabilitados hasta cambiar el paradigma porque los requests no autenticados tienen un limite de 60 por hora:
            https://developer.github.com/v3/#rate-limiting
          Implementar autenticacion (dificil), utilizar otro metodo o esperar fallas
        */ 
        //projWrongInput('inexistent organization on github (#18)', orgWithSlashes, project, /inexistent organization on github/);
        //projWrongInput('inexistent project on github (#18)', 'codenautas', 'inexistent-on-github', /inexistent project on github/);
        it('should create project (#8)', function(done) {
            sinon.stub(qacServices, 'existsOnGithub', function() { return Promise.resolve({}); });
            qacServices.createProject(orgWithSlashes, project).then(function(status) {
                expect(status).to.eql('project "'+project+'" created');
                return qacServices.getInfo(orgWithSlashes, project);
            }).then(function(info) {
                expect(info.organization.name).to.eql(orgWithSlashes);
                expect(info.organization.projects).to.eql([{'projectName':project}]);
                expect(info.project.name).to.eql(project);
                done();
            }).catch(function(err) {
                console.log("Err", err);
                done(err);
            }).then(function() {
                qacServices.disconnect();
            });
        });
        projWrongInput('duplicate project (#16)', orgWithSlashes, project, /duplicate project/);
        it('should return error message', function() {
            var genMsg = 'fs.remove() generated error';
            sinon.stub(fs, 'remove', function() { return Promise.reject({message:genMsg}); });
            return qacServices.deleteData(orgWithSlashes).then(function(status) {
                expect(status).to.eql(genMsg);
                fs.remove.restore();
            });
        });
        it('should remove project', function() {
            return qacServices.deleteData(orgWithSlashes, project).then(function(status) {
                expect(status).to.eql('project "'+project+'" removed');
                return qacServices.getInfo(orgWithSlashes);
            }).then(function(info) {
                expect(info.organization.projects).to.eql([]);
            });
        });
        it('should remove organization', function(done) {
            qacServices.deleteData(orgWithSlashes).then(function(status) {
                expect(status).to.eql('organization "'+orgWithSlashes+'" removed');
                return qacServices.getInfo(orgWithSlashes);
            }).then(function(info) {
                done('should fail');
            }, function(err) {
                expect(err.message).to.match(/inexistent organization/)
                done();
            });
        });
    });
 });