"use strict";

var qacServices={};

var app = require('express')();
var createHmac = require('create-hmac');

qacServices.config = function(opts){
    
}

qacServices.receivePush = function receivePush(){
    return app.post('/push/:group/:project',function receivePushService(req,res){
        var eventType=req.headers['x-github-event'];
        if(!eventType){
            res.status(400);
            res.end('bad request. Missing X-GitHub-Event header');
            return ;
        }
        res.status(404);
        res.write('not found!!! '+req.params.project);
        res.end();
    });
};

qacServices.getGroup = function getGroup(groupName){
    return {
        getProject:function getProject(projectName){
            return {
                info:{}
            };
        }
    };
};

qacServices.isValidRequest = function isValidRequest(payload, keyInHeader, secret) {
    var hmac = createHmac('sha1',  new Buffer(secret, 'utf8'));
    hmac.end(payload, 'utf8');
    return 'sha1='+hmac.read().toString('hex')===keyInHeader;
};

module.exports=qacServices;