"use strict";

var qacServices={};

var app = require('express')();
var crypto = require('crypto');
var Promises = require('best-promise');
var fs = require('fs-promise');
var Path = require('path');
var OS = require('os');
var bodyParser = require('body-parser')

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
}

qacServices.receivePush = function receivePush(){
    return app.post('/push/:group/:project',function receivePushService(req,res){
        try {
        //console.log("header", req.headers);
        //console.log("body", req.body);
        var eventType=req.headers['x-github-event'];
        if(!eventType){
            res.status(400);
            res.end('bad request. Missing X-GitHub-Event header');
            return;
        }
        // validar request
        var githubSig = req.headers['x-hub-signature'];
        //console.log("githubSig", githubSig);
        if(githubSig && ! qacServices.isValidRequest(JSON.stringify(req.body), githubSig, qacServices.request_secret)) {
            res.status(500);
            res.end('bad request. Invalid x-hub-signature');
            return;
        }
        // guardar en base de datos
        
        // responder 
        res.write('ok: '+req.body.head_commit.timestamp)
        res.end();
        }catch(e) {
            res.status(500);
            console.log("mal", e);
            res.end("todo mal");
        }
    });
};

qacServices.getInfo = function getInfo(groupName, projectName){
    var info={};
    return info;
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