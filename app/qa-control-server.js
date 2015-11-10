"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */

// APP

var _ = require('lodash');
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var Promises = require('best-promise');
var fs = require('fs-promise');
var readYaml = require('read-yaml-promise');
// var extensionServeStatic = require('extension-serve-static');
// var MiniTools = require('mini-tools');
// var jade = require('jade');

var qacServices = require('../lib/qac-services.js');
var qacAdminServices = require('../lib/qac-admin.js');

// var crypto = require('crypto');
// function md5(text){
    // return crypto.createHash('md5').update(text).digest('hex');
// }

app.use(cookieParser());
// app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.use(function(req,res,next){
    if("quiero ver todo"){
        console.log('***************************');
        console.dir(req,{depth:0});
        console.log('req.cookies',req.cookies);
        console.log('req.query  ',req.query  );
        console.log('req.body   ',req.body   );
        console.log('req.params ',req.params );
        console.log('req.headers',req.headers);
        // console.dir(res,{depth:0});
    }
    next();
});

var actualConfig;

Promises.start(function(){
    return readYaml('global-config.yaml',{encoding: 'utf8'});
}).then(function(globalConfig){
    actualConfig=globalConfig;
    return readYaml('local-config.yaml',{encoding: 'utf8'}).catch(function(err){
        if(err.code!=='ENOENT'){
            throw err;
        }
        return {};
    }).then(function(localConfig){
        _.merge(actualConfig,localConfig);
    });
}).then(function(){
    var server=app.listen(actualConfig.server.port, function(event) {
        console.log('Listening on port %d', server.address().port);
    });
    
    qacServices.config(actualConfig.services);
    
    qacAdminServices.config(qacServices, actualConfig.services);
    app.use(qacAdminServices.adminServe());
    
    app.use(qacServices.receivePush());
    app.use(qacServices.overviewServe());
    
    app.get('/', function(req, res, next) {
       var name='QA Control Server';
       res.end('<!doctype html>\n<html><head>'+
               '<link href="/markdown.css" media="all" rel="stylesheet" />'+
               '<link href="/markdown2.css" media="all" rel="stylesheet" />'+
               '<link href="/github.css" media="all" rel="stylesheet" />'+
               '<title>'+name+'</title>'+
               '</head><body><div align="center">'+
                '<img src="/qcs.png" /></img>'+
                '<span class="vcard-fullname" itemprop="name">'+
                'Welcome to '+name+'!'+
                '</span>'+
                '</div></body></html>'); 
    });
}).catch(function(err){
    console.log('ERROR',err);
    console.log('STACK',err.stack);
});
