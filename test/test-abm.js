"use strict";
var expect = require('expect.js');
var Promises = require('best-promise');
var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
var helper=require('../test/test-helper.js');
var _ = require('lodash');
var sinon = require('sinon');
       
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
        var orgWithSlashes='org-with-slashes';
        var project='proj1', project2='proj2';
        it('should create organization (#7)', function(done) {
            return qacServices.createOrganization(orgWithSlashes).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('organization "'+orgWithSlashes+'" created');
                return qacServices.getInfo(orgWithSlashes);
            }).then(function(info) {
                //console.log(info);
                expect(info.organization.name).to.eql(orgWithSlashes);
                expect(info.organization.projects).to.eql([]);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        function projWrongInput(msg, org, proj, expRE, sinonEOG) {
            it('createProject should fail with '+msg, function(done) {
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
                    //console.log("no fallo", rv);
                    throw new Error('should fail');
                },function(err){
                    if(sinonEOG) { qacServices.existsOnGithub.restore(); }
                    //console.log("SI FALLO", err.stack);
                    expect(err.message).to.match(expRE);
                }).then(done,done);
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
            sinon.stub(qacServices, 'existsOnGithub', function() { return Promises.resolve({}); });
            return qacServices.createProject(orgWithSlashes, project).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('project "'+project+'" created');
                return qacServices.getInfo(orgWithSlashes, project);
            }).then(function(info) {
                //console.log(info);
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
        it('should return error message', function(done) {
            var genMsg = 'fs.remove() generated error';
            sinon.stub(fs, 'remove', function() { return Promises.reject({message:genMsg}); });
            return qacServices.deleteData(orgWithSlashes).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql(genMsg);
                fs.remove.restore();
                done();
            }, function(err) {
                done('should not fail', err);
            });
        });
        it('should remove project', function(done) {
            return qacServices.deleteData(orgWithSlashes, project).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('project "'+project+'" removed');
                return qacServices.getInfo(orgWithSlashes);
            }).then(function(info) {
                //console.log(info);
                expect(info.organization.projects).to.eql([]);
                done();
            }, function(err) {
                done(err);
            });
        });
        it('should remove organization', function(done) {
            return qacServices.deleteData(orgWithSlashes).then(function(status) {
                //console.log("status", status);
                expect(status).to.eql('organization "'+orgWithSlashes+'" removed');
                return qacServices.getInfo(orgWithSlashes);
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