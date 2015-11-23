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
var qacServices = require('../lib/qac-services.js');
var qcsCommon = require('../lib/qcs-common.js');
require('colors');

var html = require('js-to-html').html;
html.insecureModeEnabled = true;

if(false) {
    var extensionServeStatic = require('extension-serve-static');
    var MiniTools = require('mini-tools');    
    var validExts=[
        'html',
        'jpg','png','gif',
        'css','js','manifest'];
    app.use('/', extensionServeStatic('app', {staticExtensions:validExts}));
}

// var jade = require('jade');
    
app.use(cookieParser());
// app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.use(function(req,res,next){
    if(! "quiero ver todo"){
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
    console.log("actualConfig", actualConfig);
    var server=app.listen(actualConfig.server.port, function(event) {
        console.log('Listening on port %d', server.address().port);
    });
    qacServices.config(actualConfig.services, actualConfig.production);
    app.get('/', function(req, res, next) {
        var name='QA Control Server';
        res.end(qcsCommon.simpleHtml(
            name,
            [ html.div({"style":'text-align:center'},[
                html.img({src:'/' + (actualConfig.production ? 'qcs.png' : 'qcs-devel.png')}),
                html.span({'class':"vcard-fullname", itemprop:"name"},'Welcome to '+name+'!')
            ]) ]
        ));
    });
    app.use(qacServices.receivePush());
    if(! actualConfig.production){
        console.log('!production: manual push enabled'.magenta); // no quitar este console.log!
        app.use(qacServices.receiveManualPush());
    }
    app.use(qacServices.overviewServe());
    // este va sin auth, debe ir antes de los últimos dos!
    if(! actualConfig.production) {
        console.log('!production: manual abms enabled'.magenta); // no quitar este console.log!
        app.use(qacServices.abmsManualServe());
    }
    // estos deben ir al final
    app.use(qacServices.abmsServe());
    app.use(qacServices.adminServe());
}).catch(function(err){
    console.log('ERROR',err);
    console.log('STACK',err.stack);
});
