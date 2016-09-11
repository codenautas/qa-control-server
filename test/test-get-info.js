"use strict";
var expect = require('expect.js');
var qacServices = require('../lib/qac-services.js');
var helper=require('../test/test-helper.js');
var _ = require('lodash');
var sinon = require('sinon');
var Promises = require('best-promise');
var fs = require('fs-promise');
var Path = require('path');

describe('qac-services information functions', function(){
    helper.setup(qacServices);
    describe('getInfo', function() {
        var organization='sourcetravelers';
        var project='the-app', project2='other-app';
        var notADir = 'aFileNotADir';
        function testBadInput(msg, p1, p2, expRE, sinonFS, sinonSTAT) {
            it('should fail with '+msg, function() {
                if(sinonFS) {
                    sinon.stub(fs, 'readFile', function(pathDeJson){
                        var jsf = fs.readFileSync(pathDeJson, 'utf8');
                        jsf = jsf.slice(0, jsf.indexOf(']'))+',\n{"projectName":"'+sinonFS+'"}\n]'
                        //console.log("stubbed readFile", pathDeJson, jsf);
                        return Promises.resolve(jsf);
                    });
                }
                if(sinonSTAT) {
                    sinon.stub(fs, 'stat', function(path){
                        if(new RegExp(project).test(path)) {
                            return Promises.reject({message:'STUBBED stat', code:'not-ENOENT'});
                        }
                        if(new RegExp(project2).test(path)) {
                            return Promises.reject({message:'STUBBED stat', code:'ENOENT'});
                        }
                        return Promises.resolve({isDirectory:function() { return true;} });
                    });
                }
                return qacServices.getInfo(p1, p2).then(function(info) {
                    console.log("info", info);
                    throw new Error('should fail');
                },function(err){
                    if(sinonFS) { fs.readFile.restore(); }
                    if(sinonSTAT) { fs.stat.restore(); }
                    expect(err.message).to.match(expRE);
                });
            });            
        }
        testBadInput('missing parameters', null, null, /missing organization/);
        testBadInput('missing organization', 'non-existent-organization', null, /inexistent organization/);
        testBadInput('missing organization directory', notADir , project, /invalid organization/);
        testBadInput('missing project', organization, 'not-an-app', /inexistent project/);
        testBadInput('missing project directory', organization, notADir, /invalid project/, notADir);
        testBadInput('missing project directory wrong error', organization, project, /STUBBED stat/, false, true);
        testBadInput('missing project directory right error', organization, project2, /invalid project/, false, true);
        
        it('should return organization info', function() {
            return qacServices.getInfo(organization).then(function(info) {
                expect(info.organization.name).to.be(organization);
                expect(info.organization.path).to.match(new RegExp(organization));
                //console.log("info", info.organization.projects);
                expect(info.organization.projects).to.eql([{projectName:project2}, {projectName:project}]);
            });
        });
        it('should return project info', function() {
            return qacServices.getInfo(organization, project).then(function(info) {
                expect(info.organization.name).to.be(organization);
                expect(info.organization.path).to.match(new RegExp(organization));
                expect(info.project.name).to.be(project);
                expect(info.project.path).to.match(new RegExp(project));
            });
        });
        describe('coverage', function() {
            it('forward wrong error', function(done) {
                sinon.stub(fs, 'stat', function(path){
                    return Promises.reject({message:'file not found', code:'not-ENOENT'});
                });
                qacServices.getInfo('wrong-organization', project).then(function(info) {
                    console.log("info", info)
                    done('should fail'); 
                }).catch(function(err) {
                    expect(err.code).to.eql('not-ENOENT');
                    fs.stat.restore();
                    done();
                });
            });
        });
    });
    describe('getOrganizations', function() {
        it('should fail on inexistent repository path', function(done) {
            var oriPath = _.clone(qacServices.repository.path);
            qacServices.repository.path = '/non/existent/path/';
            qacServices.getOrganizations().then(function(orgs) {
                throw new Error('should fail');
            },function(err){
                expect(err.message).to.match(/inexistent repository/);
            }).then(done,done).then(function() {
                qacServices.repository.path = oriPath;
            });
        });
        it('should return the list of organizations', function() {
            return qacServices.getOrganizations().then(function(orgs) {
               expect(orgs).to.eql(['codenautas','emptygroup','sourcetravelers']);
            });
        });
    });
});
