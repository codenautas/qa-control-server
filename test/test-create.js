"use strict";
var expect = require('expect.js');
var Promises = require('best-promise');
//var fs = require('fs-promise');
var qacServices = require('../lib/qac-services.js');
//var Path = require('path');
var helper=require('../test/test-helper.js');
var _ = require('lodash');

describe('qac-services modification functions', function(){
    helper.setup(qacServices);
    describe('createOrganization', function() {
        function testWrongInput(msg, p1, expRE) {
            it('should fail with '+msg, function(done) {
                return qacServices.createOrganization(p1).then(function(rv) {
                    //console.log("no fallo", rv);
                    throw new Error('should fail');
                },function(err){
                    //console.log("SI FALLO", err.stack);
                    expect(err.message).to.match(expRE);
                }).then(done,done);
            });            
        }
        testWrongInput('missing name', null, /missing organization name/);
        testWrongInput('existing organization', 'sourcetravelers', /cannot create existing organization/);
        var organization='neworg';
        var project='proj1', project2='proj2';
        it('should create organization', function(done) {
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
    });
 });