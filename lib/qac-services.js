"use strict";

var qacServices={};

var app = require('express')();
var crypto = require('crypto');
var Promises = require('best-promise');
var fs = require('fs-promise');

qacServices.repository = './repositories';
qacServices.config = function(opts){
    if(opts) {
        if(opts.repository) {
            qacServices.repository = opts.repository;
        }
    }
}

qacServices.receivePush = function receivePush(){
    return app.post('/push/:group/:project',function receivePushService(req,res){
        //console.log(req.headers);
        // TODO: investigar si es express el que pone en minusculas los headers o supertest!
        var eventType=req.headers['x-github-event'];
        if(!eventType){
            res.status(400);
            res.end('bad request. Missing X-GitHub-Event header');
            return;
        }
        res.status(404);
        res.write('not found!!! '+req.params.project);
        res.end();
    });
};

qacServices.getGroup = function getGroup(groupName){
/*
    fs.readdir(qacServices.repository).then(function(files) {
        return Promises.all(files.map(function(file){
            var iFile = Path.normalize(qacServices.repository+'/'+file);
            return Promises.start(function() {
                return fs.readFile(iFile, 'utf8');
            }).then(function(content) {
                var kFile = file.substr(0, file.length-Path.extname(file).length);
                if(!( kFile in samples)) { samples[kFile] = {}; }
                if(iFile.match(/(.headers)$/)) {
                    samples[kFile]['headers'] = helper.headersFromFile(content);;
                } else {
                    samples[kFile]['payload'] = content;
                }
            });                    
        })).then(function() {
            done();
        });
    }).then(function() {
        for(var h in samples) {
            var wh=samples[h];
            expect(qacServices.isValidRequest(wh.payload, wh.headers['X-Hub-Signature'], secretKey)).to.be.ok();
        }
    }).catch(function(err) {
        console.log("mal", err);
        done(err);
    });
*/
    return {
        getProject:function getProject(projectName){
            return {
                info:{}
            };
        }
    };
};

qacServices.isValidRequest = function isValidRequest(payload, keyInHeader, secret) {
    var hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('hex');
    hmac.write(payload);
    hmac.end();
    return 'sha1='+hmac.read().toString('hex')===keyInHeader;
};

qacServices.makeOverviewMd = function makeOverviewMd(groupName){
    return Promises.resolve('not yet');
}

qacServices.makeOverviewHtml = function makeOverviewHtml(groupName){
    return Promises.resolve('not yet html');
}

qacServices.overviewServe = function overviewServe(){
    var thisModule = this;
    return app.get('/:group',function(req,res,next){
        thisModule.makeOverviewHtml(req.params.group).then(function(content){
            res.end(content);
        });
    });
}

module.exports=qacServices;