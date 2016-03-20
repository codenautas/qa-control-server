"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint node:true */

// APP

if(process.argv[2]=='--dir'){
    process.chdir(process.argv[3]);
    console.log('cwd',process.cwd());
}

var _ = require('lodash');
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var Promises = require('best-promise');
var fs = require('fs-promise');
var readYaml = require('read-yaml-promise');
var kill9 = require('kill-9');
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
    app.use(qacServices.rootUrl, extensionServeStatic('app', {staticExtensions:validExts}));
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
}).then(function() {
    return fs.readJSON('./package.json', 'utf8');
}).then(function(packageJSON){
    console.log("packageJSON", packageJSON.version);
    console.log("actualConfig", actualConfig);
    app.use('/github', kill9({pid:actualConfig.server["kill-pid"]}));
    qacServices.config(actualConfig.services, actualConfig.production);
    // este va primero!
    console.log("ROOT URL", qacServices.rootUrl);
    app.get(qacServices.rootUrl, function(req, res, next) {
        var name='QA Control Server v.'+packageJSON.version;
        var repo_info = actualConfig.production ?
            html.div('') :
            html.div({"class":'right-align'}, qacServices.repository.path);
        res.end(qcsCommon.simpleHtml(
            name,
            [ html.div({"class":'right-align'},[
                html.img({src:qacServices.rootUrl + (actualConfig.production ? 'qcs.png' : 'qcs-devel.png')}),
                html.span({'class':"vcard-fullname", itemprop:"name"},'Welcome to '+name+'!')
            ]), repo_info ],
            null,
            qacServices
        ));
    });
    app.use(qacServices.staticServe());
    app.use(qacServices.receivePush());
    if(! actualConfig.production){
        console.log('!production: manual push enabled'.magenta); // no quitar este console.log!
        app.use(qacServices.receiveManualPush());
    }
    app.use(qacServices.organizationServe());
    app.use(qacServices.projectServe());
    // este va sin auth, debe ir antes de enableLoginPlus()!
    if(! actualConfig.production) {
        console.log('!production: manual abms enabled'.magenta); // no quitar este console.log!
        app.use(qacServices.abmsManualServe());
    }
    // habilitar explicitamente la seguridad
    qacServices.enableLoginPlus(actualConfig.usersdb);
    // qacServices.enableLoginPlus();
    app.use(qacServices.askServe());
    app.use(qacServices.abmsServe());
    app.use(qacServices.adminServe());
    var server=app.listen(actualConfig.server.port, function(event) {
        console.log('Listening on port %d', server.address().port);
    });
}).catch(function(err){
    console.log('ERROR',err);
    console.log('STACK',err.stack);
});
