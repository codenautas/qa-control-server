"use strict";

var qacServices={};

var app = require('express')();
var crypto = require('crypto');
var Promises = require('best-promise');
var fs = require('fs-promise');
var Path = require('path');
var OS = require('os');
var bodyParser = require('body-parser');
var execToHtml = require('exec-to-html');
var qaControl = require('qa-control');

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

function Bitacora(outputDir) {
    this.outputDir = outputDir;
    this.data = [];
    this.now = function() {
        var d=new Date().toJSON().replace(/:/g,'').replace('T','_');//.replace(/-/g, '');
        return d.substr(0, d.length-5);
    };
    this.logAll = function(type, data) {
        //console.log("logAll", type, data);
        this.data.push({date:this.now(), type:type, data:data});
    };
    this.log = function(origin, action, text) {
        //console.log("log", origin, action, text);
        this.data.push({date:this.now(), origin:origin, action:action, text:text});
    };
    // logs and throws exception
    this.fail = function(data, exception) {
        this.logAll('exception', data);
        this.finish();
        throw exception;
    };
    this.finish = function() {
        function isBitacora(obj) { return 'origin' in obj; }
        function isAll(obj) { return ! isBitacora(obj); }
        var logs = this.data;
        var outDir = this.outputDir;
        var fileBita = logs.filter(isBitacora);
        var vNow = this.now();
        //console.log('fileBita', fileBita);
        fs.writeFile(outDir+vNow+'_bita.json', JSON.stringify(fileBita), {encoding:'utf8'}).then(function() {
            var fileAll = logs.filter(isAll);
            //console.log('fileAll', fileAll);
            return fs.writeFile(outDir+vNow+'_all.json', JSON.stringify(fileAll), {encoding:'utf8'});
        }).then(function() {
            //console.log("bitacora guardada");
        }).catch(function(err) {
            console.log("bitacora ERROR", err.stack);
        });
    };
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
            res.status(403);
            res.end('unauthorized request. Invalid x-hub-signature');
            return;
        }
        // guardar en base de datos
        var repo=req.body.repository;
        var info;
        var clonePath;
        var bitacora = null;
        qacServices.getInfo(repo.organization, {project:repo.name, createProject:true}).then(function(nfo) {
            info = nfo;
            bitacora = new Bitacora(Path.normalize(info.project.path+'/info/'));
            clonePath = Path.normalize(info.project.path+'/source');
            return fs.stat(clonePath);
        }).then(function() {
            return false;
        }).catch(function(err) {
            if(err.code !== 'ENOENT') { bitacora.fail(err); }
            return true;
        }).then(function(needClone) {
            var gitCmd = needClone ?
                'git clone '+repo.html_url+'.git '+clonePath :
                'git --git-dir='+clonePath+Path.normalize('/.git')+' pull';
            return execToHtml.run(gitCmd, {echo:true, collect:true, exit:true});
        }).then(function(result) {
            bitacora.logAll('command', result);
            bitacora.log('command', result.command, result.stdout ? result.stdout : result.stderr);
            if(result.exit != 0) {
                bitacora.fail(new Error("git failed with code"));
            }
            //return qaControl.controlProject(clonePath);
            res.write('ok: '+req.body.head_commit.timestamp)
            res.end();
            //console.log("bitacora", bitacora);
            bitacora.finish();
        }).catch(function(err) {
            console.log("err", err);
            res.status(500);
            res.end(err.message);
        });
    });
};

// parameters:
//           groupName: name of group
//        opts.project: name of project
//  opts.createProject: create project if not exists
//                      and is listed on groupName/params/projects.json
qacServices.getInfo = function getInfo(groupName, opts){
    var info={};
    opts = opts || {};
    return Promises.start(function() {
        if(!groupName) {
            throw new Error('missing group');
        }
        info.group = {
            path:Path.normalize(qacServices.repository+'/groups/'+groupName),
            name:groupName
        };
        return fs.stat(info.group.path).catch(function(err) {
            if(err.code==='ENOENT') {
                throw new Error('inexistent group "'+groupName+'"');
            }
            throw err;
        }).then(function(st) {
            if(!st.isDirectory()) {
                throw new Error('invalid group "'+groupName+'"');
            }
        }).then(function() {
            return fs.readFile(Path.normalize(info.group.path+'/params/projects.json'),'utf8');
        }).then(JSON.parse).then(function(projects) {
            if(opts.project) {
                var projectFound=projects.filter(function(element, index, array) {
                    return element.projectName==opts.project;
                });
                if(!projectFound) {
                    throw new Error('inexistent project "'+opts.project+'"');
                }
                info.project = {
                    path:Path.normalize(info.group.path+'/projects/'+opts.project),
                    name:opts.project
                };
                return fs.stat(info.project.path).catch(function(err) {
                    if(err.code!=='ENOENT') {
                        throw err;
                    } else {
                        if(! opts.createProject) {
                            throw new Error('inexistent project "'+opts.project+'"');
                        }
                        return fs.mkdir(info.project.path).then(function(){
                            var folders=['result', 'info', 'params'/*, 'source'*/];
                            return Promises.all(folders.map(function(folder) {
                                return fs.mkdir(Path.normalize(info.project.path+'/'+folder));
                            }));
                        }).then(function(){
                            return {isDirectory:function() { return true; }};
                        });
                    }
                }).then(function(st) {
                    if(!st.isDirectory()) {
                        throw new Error('invalid project "'+opts.project+'"');
                    }
                    return info;
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
    return fs.readFile(groupParams, 'utf8').then(function(content) {
        var projects = JSON.parse(content);
        return Promises.all(projects.map(function(project) {
            return fs.readFile(Path.normalize(groupBase+'/projects/'+project.projectName+'/result/cucardas.md'), 'utf8').then(function(content){
				return '**'+project.projectName+'**\n'+content+'\n';
			});
        })).then(function(contents){
			return contents.join('');
        });        
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