"use strict";

var qacServices={};

var app = require('express')();
var createHmac = require('create-hmac');
var Promises = require('best-promise');

qacServices.config = function(opts){
    
}

qacServices.receivePush = function receivePush(){
    return app.post('/push/:group/:project',function receivePushService(req,res){
        //console.log(req.headers);
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