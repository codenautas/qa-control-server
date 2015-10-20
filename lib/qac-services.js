"use strict";

var qacServices={};

var app = require('express')();

qacServices.config = function(opts){
    
}

qacServices.receivePush = function(){
    console.log('preparando')
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

qacServices.validateRequest = function validateRequest(payload, keyInHeader, secret) {

};

module.exports=qacServices;