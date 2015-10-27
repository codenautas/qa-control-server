"use strict";

var qacServices={};

var app = require('express')();
var crypto = require('crypto');
var Promises = require('best-promise');
var fs = require('fs-promise');
var Path = require('path');
var OS = require('os');
var bodyParser = require('body-parser');

app.use(bodyParser.json());

qacServices.repository = './repositories';
qacServices.request_secret = 'HK39Sas_D--lld#h./@';
qacServices.config = function(opts){
    if(opts) {
        if(opts.repository) {
            qacServices.repository = opts.repository;
            qacServices.request_secret = opts.request_secret;
        }
    }
};

qacServices.receivePush = function receivePush(){
    return app.post('/push/:group/:project',function receivePushService(req,res){
        var eventType=req.headers['x-github-event'];
        if(!eventType){
            res.status(400);
            res.end('bad request. Missing X-GitHub-Event header');
            return;
        }
        // validar request
        var githubSig = req.headers['x-hub-signature'];
        if(githubSig && ! qacServices.isValidRequest(JSON.stringify(req.body), githubSig, qacServices.request_secret)) {
            res.status(500);
            res.end('bad request. Invalid x-hub-signature');
            return;
        }
        // guardar en base de datos
        var repo=req.body.repository;
        qacServices.getInfo(repo.organization, repo.name).then(function(info) {
            //console.log("info", info);
            // responder 
            res.write('ok: '+req.body.head_commit.timestamp)
            res.end();
        }).catch(function(err) {
            res.status(500);
            res.end(err.message);
        });
    });
};

qacServices.getInfo = function getInfo(groupName, opts){
    var info={};
    opts = opts || {};
    var projects = null;
    return Promises.start(function() {
        if(!groupName) {
            throw new Error('missing group');
        }
        info.group = {
            path:Path.normalize(qacServices.repository+'/groups/'+groupName),
            name:groupName
        };
        return fs.stat(info.group.path).then(function(st) {
            if(!st.isDirectory()) {
                throw new Error('invalid group "'+groupName+'"');
            }
        }).catch(function(err) {
            if(err.code==='ENOENT') {
                throw new Error('inexistent group "'+groupName+'"');
            }
            throw err;
        }).then(function() {
            return fs.readFile(Path.normalize(info.group.path+'/params/projects.json'),'utf8');
        }).then(function(content) {
            projects = JSON.parse(content);
        }).then(function() {
            if(opts.project) {
                info.project = {
                    path:Path.normalize(info.group.path+'/projects/'+opts.project),
                    name:opts.project
                };
                return fs.stat(info.project.path).then(function(st) {
                    if(!st.isDirectory()) {
                        throw new Error('invalid project "'+opts.project+'"');
                    }
                    return info;
                }).catch(function(err) {
                    if(err.code==='ENOENT') {
                       throw new Error('inexistent project "'+opts.project+'"');
                    }
                    throw err;
                });
            } else {
                info.group.projects = projects;
            }
        }).then(function() {
            return info;
        });
    });
};

qacServices.isValidRequest = function isValidRequest(payload, keyInHeader, secret) {
    var hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('hex');
    hmac.write(payload);
    hmac.end();
    var rv = 'sha1='+hmac.read().toString('hex')===keyInHeader;
    //console.log("secret", secret, "keyInHeader", keyInHeader, "result: ", rv);
    return rv;
};

qacServices.makeOverviewMd = function makeOverviewMd(groupName){
    var groupBase = qacServices.repository+'/groups/'+groupName+'/';
    var groupParams = Path.normalize(groupBase+'params/projects.json');
    var overview = '';
    return fs.readFile(groupParams, 'utf8').then(function(content) {
        var projects = JSON.parse(content);
        return Promises.all(projects.map(function(project) {
            return fs.readFile(Path.normalize(groupBase+'/projects/'+project.projectName+'/result/cucardas.md'), 'utf8').then(function(content) {
                overview += '**'+project.projectName+'**'+OS.EOL+content + OS.EOL;
            });
        }));
    }).then(function() {
        overview = overview.substring(0, overview.length-OS.EOL.length);
        return overview;
    });
};

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