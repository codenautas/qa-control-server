"use strict";

var app = require('express')();

var pushReceiver={};

pushReceiver.serve = function(){
    return app.post('/push/:project',function serveQaControlPushReceiver(req,res){
        var eventType=req.headers['x-github-event'];
        console.log('eventType', eventType);
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

module.exports=pushReceiver;