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
var request = require('request-promise');
var loginPlus = new (require('login-plus').Manager);
var cookieParser = require('cookie-parser');
var qcsCommon = require('./qcs-common.js');
var miniTools = require('mini-tools');
var html = require('js-to-html').html;
html.insecureModeEnabled = true;

app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));

qacServices = {
    production: true,
    repository: {
        path : './repositories',
        request_secret: 'HK39Sas_D--lld#h./@'
    },
    rootUrl:'/'
};

qacServices.config = function(opts, production){
    if(production == null){
        throw new Error("must set 'production' in config");
    }
    if(opts && opts.repository) {
        qacServices.repository = opts.repository;
    }
    if(opts && opts["root-url"]) {
        qacServices.rootUrl = opts["root-url"];
    }
    qacServices.production = !!production;
};

qacServices.cucardasToHtmlList = function cucardasToHtmlList(cucardasMd) {
    var e_link = '([^)]+)';
    var e_img = '!\\[([^\\]]+)]\\('+e_link+'\\)';
    var e_cucarda = '(?:'+e_img+'|\\['+e_img+']\\('+e_link+'\\))';
    var cucardasHtml = [];
    cucardasMd.replace(new RegExp(e_cucarda,'g'),function(cucarda, name, imgSrc, name2, imgSrc2, url){
        var htmlCucarda;
        name = name || name2;
        htmlCucarda = html.img({src:imgSrc||imgSrc2, alt:name});
        if(url){
            htmlCucarda = html.a( {href:url}, [htmlCucarda]);
        }
        var position=qacServices.cucardasToHtmlList.order[name]||qacServices.cucardasToHtmlList.order._OTHERS_;
        while(cucardasHtml.length<position){
            cucardasHtml.push([]);
        }
        cucardasHtml[position-1].push(htmlCucarda);
    });
    while(cucardasHtml.length<qacServices.cucardasToHtmlList.order._OTHERS_){
        /* istanbul ignore next */
        cucardasHtml.push([]);
    }
    return cucardasHtml.map(function(cucardasOnePosition){
        return html.td({class:'centrado'}, cucardasOnePosition);
    });
};

qacServices.cucardasToHtmlList.order={
    stable:1, 
    extending:1, 
    designing:1,
    training:1,
    "proof-of-concept":1,
    example:1,
    "npm-version":2,
    downloads:3,
    build:4,
    linux:4,
    windows:5,
    coverage:6,
    climate:7,
    dependencies:8,
    issues:9,
    "qa-control": 10,
    _OTHERS_: 11
}

qacServices.orgNameToHtmlLink = function orgNameToHtmlLink(organization) {
    return html.a({href:qacServices.rootUrl+organization}, organization);
};

qacServices.projectNameToHtmlLink = function projectNameToHtmlLink(organization, project) {
    return html.a({href:'https://github.com/'+organization+'/'+project}, project);
};

qacServices.setSession = function setSession(req) {
    //console.log(req);
    var users = qacServices.users ? qacServices.users : {};
    var connectSID = req && req.cookies ? req.cookies['connect.sid'] : null;
    if(connectSID && req.session && req.session.passport && req.session.passport.user) {
        users[connectSID] = req.session.passport.user;
    }
    return users;
    //return (req.session||{passport:{}}).passport.user;
};

qacServices.validSession = function validSession(req) {
    var connectSID = req && req.cookies ? req.cookies['connect.sid'] : null;
    //console.log("SESSION", req.session);
    //console.log("COOKIES", req.cookies);
    return qacServices.users && connectSID && connectSID in qacServices.users;
};

// parameters:
//  organization: name of organization
//       project: optional project name
qacServices.getInfo = function getInfo(organization, project){
    var info={};
    return Promises.start(function() {
        if(!organization) {
            throw new Error('missing organization');
        }
        info.organization = {
            path:Path.normalize(qacServices.repository.path+'/groups/'+organization),
            name:organization
        };
        info.organization.projectsJsonPath = Path.normalize(info.organization.path+'/params/projects.json');
        return fs.stat(info.organization.path).catch(function(err) {
            if(err.code==='ENOENT') {
                var err2=new Error('inexistent organization "'+organization+'"');
                err2.statusCode=404;
                throw err2;
            }
            throw err;
        }).then(function(st) {
            if(!st.isDirectory()) {
                throw new Error('invalid organization "'+organization+'"');
            }
        }).then(function() {
            return fs.readFile(info.organization.projectsJsonPath,'utf8');
        }).then(JSON.parse).then(function(projects) {
            info.organization.projects = projects;
            if(!!project) {
                var projectFound=projects.filter(function(element, index, array) {
                    return element.projectName==project;
                });
                if(! projectFound.length) {
                    var err2 = new Error('inexistent project "'+project+'"');
                    err2.statusCode=404;
                    throw err2;
                }
                info.project = {
                    path:Path.normalize(info.organization.path+'/projects/'+project),
                    name:project
                };
                return fs.stat(info.project.path).catch(function(err) {
                    if(err.code !== 'ENOENT') { throw err; }
                    else { return {isDirectory: function() { return false; }}; }
                }).then(function(st) {
                    if(!st.isDirectory()) {
                        throw new Error('invalid project "'+project+'"');
                    }
                    return info;
                });
            }
        }).then(function() {
            return info;
        });
    });
};

qacServices.orgActionButtons = function orgActionButtons(req, organization){
    var tds=[];
    if(qacServices.validSession(req)) {
        tds.push(html.td({class:'centrado'}, [
            html.a({
                href: qacServices.rootUrl+'ask/delete/'+organization,
                'codenautas-confirm': 'row'
            },[html.img({src:qacServices.rootUrl+'delete.png', alt:'del', style:'height:18px'})])
        ]))
    }
    return tds;
}

qacServices.projectActionButtons = function projectActionButtons(req, organization, project){
    var tds=[];
    if(qacServices.validSession(req)) {
        tds.push(html.td([
            html.a({
                href: qacServices.rootUrl+'ask/delete/'+organization+'/'+project,
                'codenautas-confirm': 'row'
            },[html.img({src:qacServices.rootUrl+'delete.png', alt:'del', style:'height:18px'})])
        ]))
        tds.push(html.td([
            html.a({
                href:qacServices.rootUrl+'refresh/'+organization+'/'+project
            }, [html.img({src:qacServices.rootUrl+'refresh.png', alt:'rfrsh', style:'height:18px'})])
        ]));
    }
    return tds;
}

qacServices.orgAddButton = function orgAddButton(req){
    var ret=[];
    if(qacServices.validSession(req)) {
        ret.push(
            html.input({type:'hidden', name:'action',       value:'create'}),
            html.input({type:'text',   name:'organization'}),
            html.input({type:'submit', value:'New organization...'})
        )
    }
    return ret;
};

qacServices.projectAddButton = function projectAddButton(req, organization){
    var ret=[];
    if(qacServices.validSession(req)) {
        ret.push(
            html.input({type:'hidden', name:'action',       value:'add'}),
            html.input({type:'hidden', name:'organization', value:organization}),
            html.input({type:'text',   name:'project'}),
            html.input({type:'submit', value:'New project...'})
        )
    }
    return ret;
}

qacServices.getProject = function getProject(req, info, project) {
    //console.log("info", info); console.log("project", project);
    var organization = info.organization.name;
    return fs.readFile(Path.normalize(info.organization.path+'/projects/'+project.projectName+'/result/cucardas.md'), 'utf8').catch(function(err) {
        if(err.code !== 'ENOENT') { throw err; }
        return qacServices.invalidSVG();
    }).then(function(content){
        if(!/\[issues\]/.test(content)){
            content += '[![issues](https://img.shields.io/github/issues-raw/'+organization+'/'+project.projectName+'.svg)](https://github.com/'+organization+'/'+project.projectName+'/issues)';
        }
        if(!/\[qa-control\]/.test(content)){
            content += '[![qa-control]('+(qacServices.rootUrl+organization+'/')+project.projectName+'.svg)]('+(qacServices.rootUrl+organization+'/')+project.projectName+')';
        }
        var tds = qacServices.cucardasToHtmlList(content);
        tds.unshift(html.td([qacServices.projectNameToHtmlLink(organization, project.projectName)]));
        tds = tds.concat(qacServices.projectActionButtons(req, organization, project.projectName));
        return html.tr(tds);
    });
};

qacServices.sortProjects = function sortProjects(proj1, proj2) {
    var v1=proj1.content[0].content[0].attributes['href'],
        v2=proj2.content[0].content[0].attributes['href'];
    if(v1 < v2) {
        return -1;
    } else if(v1 > v2) {
        return 1;
    }
    return 0;
}

qacServices.getOrganizationPage = function getOrganizationPage(req, organization){
    return qacServices.getInfo(organization).then(function(info) {
        if(info.organization.projects.length) {
            return Promises.all(info.organization.projects.map(function(project) {
                return qacServices.getProject(req, info, project);
            })).then(function(trs) {
                trs = trs.sort(qacServices.sortProjects);
                var tds = [ html.th('project'), html.th({colspan:qacServices.cucardasToHtmlList.order._OTHERS_-1},'cucardas')];
                if(qacServices.validSession(req)) {
                    tds.push(html.th({colspan:4},'actions'));
                }
                var all_trs = [ html.tr(tds)];
                for(var tr in trs) { all_trs.push(trs[tr]); }
                if(qacServices.validSession(req)) {
                    all_trs.push(html.tr([html.td({colspan:qacServices.cucardasToHtmlList.order._OTHERS_+(1+4), "class":'right-align'}, qacServices.projectAddButton(req, organization))]));
                }
                if(qacServices.validSession(req)) {
                    return html.form({method:'post', action:qacServices.rootUrl}, [html.table(all_trs)]);
                } else {
                    return html.table(all_trs);
                }
            });
        } else {
            if(qacServices.validSession(req)) {
                return html.form({method:'post', action:qacServices.rootUrl}, [html.table([html.tr([html.td(qacServices.projectAddButton(req, organization))])])]);
            } else {
                return html.table([html.tr([html.td(organization+' has no projects')])]);
            }
            
        }
    });
};

qacServices.getProjectLogs = function getProjectLogs(projectPath) {
    var r=[];
    return fs.readJSON(Path.normalize(projectPath+'/result/qa-control-result.json'), 'utf8').catch(function(err) {
        if(err.code !== 'ENOENT') { throw err; }
        return [];
    }).then(function(qac) {
        if(qac.length) {
            var trs=[];
            for(var b in qac) {
                var reg = qac[b];
                trs.push(
                    html.tr([
                        html.td([reg.warning]),
                        html.td([reg.params ? reg.params.join(',') : '']),
                        html.td([JSON.stringify(reg.scoring||'').replace(/[,]/g,' ').replace(/[{}"]/g,'')]),
                    ])
                );
            }
            trs.unshift(html.tr([ html.td('warning'), html.td('file'), html.td('scoring') ]));
            trs.unshift(html.tr([html.th({colspan:3}, 'QA Control result')]));
            r.push(html.hr());
            r.push(html.table(trs));
        }
        return fs.readJSON(Path.normalize(projectPath+'/result/bitacora.json'), 'utf8');
    }).catch(function(err) {
        if(err.code !== 'ENOENT') { throw err; }
        return [];
    }).then(function(bita) {
        if(bita.length) {
            var trs=[];
            for(var b in bita) {
                var reg = bita[b];
                var cls = 'stdout';
                if(reg.origin==='internal') {
                    cls = 'internal';
                } else if(reg.origin.match(/^(shell)/)) {
                    cls = 'shell';
                }
                trs.push(html.tr([
                            html.td([html.div({class:cls}, reg.text.trim())])
                                 ])
                        );
            }
            trs.unshift(html.tr([ html.th('Actions log') ]));
            r.push(html.hr());
            r.push(html.table(trs));
        }
        return r;
    });
};

qacServices.getProjectPage = function getProjectPage(req, organization, project){
    var pageCont;
    var info;
    return qacServices.getInfo(organization, project).then(function(nfo) {
        info = nfo;
        return qacServices.getProject(req, info, {projectName:project});
    }).then(function(projTR) {
        var tds = [ html.th('project'), html.th({colspan:qacServices.cucardasToHtmlList.order._OTHERS_-1},'cucardas')];
        if(qacServices.validSession(req)) {
            tds.push(html.th({colspan:4},'actions'));
        }
        var all_trs = [ html.tr(tds), projTR];
        if(qacServices.validSession(req)) {
            return html.form({method:'post', action:qacServices.rootUrl}, html.table(all_trs));
        } else {
            return html.table(all_trs);
        }
    }).then(function(content) {
        pageCont = content;
        return qacServices.getProjectLogs(info.project.path);
    }).then(function(logs) {
        if(logs.length) {
            logs.unshift(pageCont);
            return logs;
        }
        return [pageCont];
    }).then(function(content) {
        return html.body(content);
    }).catch(function(err) {
        // console.log("getProjectPage err", err);
        // console.log("getProjectPage stack", err.stack);
        throw err;
    });
};

qacServices.getAdminPage = function getAdminPage(req){
    var newOrgTR = html.tr([html.td({colspan:2, "class":'right-align'}, qacServices.orgAddButton(req))]);
    return qacServices.getOrganizations().then(function(orgs) {
        if(orgs.length) {
            return Promises.all(orgs.map(function(org) {
                var tds = [];
                tds.unshift(html.td([qacServices.orgNameToHtmlLink(org)]));
                tds = tds.concat(qacServices.orgActionButtons(req, org));
                return html.tr(tds);
            })).then(function(trs) {
                var tds = [html.th('organization')];
                if(qacServices.validSession(req)) {
                    tds.push(html.th('actions'));
                }
                var all_trs = [ html.tr(tds)];
                for(var tr in trs) { all_trs.push(trs[tr]); }
                if(qacServices.validSession(req)) {
                    all_trs.push(newOrgTR);
                }
                if(qacServices.validSession(req)) {
                    return html.form({method:'post', action:qacServices.rootUrl}, [html.table(all_trs)]);
                } else {
                    return html.table(all_trs);
                }
            });
        } else {
            if(qacServices.validSession(req)) {
                return html.form({method:'post', action:qacServices.rootUrl}, [html.table([newOrgTR])]);
            } else {
                return html.table([html.tr([html.td('There are no organizations')])]);
            }
        }
    });
};

function writeJsonToFile(filePath, jsonData) {
    return fs.writeFile(filePath, JSON.stringify(jsonData, null, 4), {encoding:'utf8'});
}

function dateForFileName() {
    var d=new Date().toJSON().replace(/:/g,'').replace('T','_');//.replace(/-/g, '');
    return d.substr(0, d.length-5);
}

function Bitacora(pathInfo, pathBita) {
    this.data = [];
    this.logAll = function(type, data) {
        this.data.push({date:dateForFileName(), type:type, data:data});
    };
    this.log = function(origin, text) {
        this.data.push({date:dateForFileName(), origin:origin, text:text});
    };
    this.finish = function() {
        function isBitacora(obj) { return 'origin' in obj; }
        function isAll(obj) { return ! isBitacora(obj); }
        var logs = this.data;
        var fileBita = logs.filter(isBitacora);
        var vNow = dateForFileName();
        writeJsonToFile(pathBita+'bitacora.json', fileBita).then(function() {
            var fileAll = logs.filter(isAll);
            return writeJsonToFile(pathInfo+'bitacora_'+vNow+'.json', fileAll);
        }).then(function() {
            //console.log("bitacora guardada");
        }).catch(function(err) {
            console.log("bitacora ERROR", err.stack);
        });
    };
};

qacServices.getResource = function getResource(name) {
    return fs.readFile('./resources/'+name, 'utf8').then(function(isvg) {
       return isvg;
    });
};

qacServices.invalidSVG = function invalidSVG() {
    return qacServices.getResource('qa--control-invalid-lightgrey.svg');
};
qacServices.naSVG = function naSVG() {
    return qacServices.getResource('qa--control-na-lightgrey.svg');
};

var reOrg = /^([a-zA-Z][a-zA-Z0-9_-]+)$/i;

qacServices.createOrganization = function createOrganization(name) {
    var orgPath = Path.normalize(qacServices.repository.path+'/groups/'+name);
    var dirs = [
        Path.normalize(orgPath+'/params'),
        Path.normalize(orgPath+'/projects')
    ];
    return Promises.start(function() {
        if(!name) { throw new Error('missing organization name'); }
        if(! name.match(reOrg)) {
            throw new Error('invalid organization name "'+name+'"');
        }
        return fs.exists(orgPath);
    }).then(function(exists) {
        if(exists) { throw new Error('cannot create existing organization "'+name+'"'); }
        return Promises.start(function(){
            return fs.mkdir(orgPath);
        }).then(function(){
            return Promises.all(dirs.map(function(dir) {
                return fs.mkdir(dir);
            }));
        }).then(function() {
            var projecsJS = Path.normalize(orgPath+'/params/projects.json');
            return fs.writeJSON(projecsJS, []).then(function() {
                return 'organization "' + name +'" created';
            });
        });
    });
};

/*
    ver https://developer.github.com/v3/#rate-limiting
    Cuando se supera este limite github devuelve 403 y esta funcion falla
    porque el request no es autenticado y el limite es de 60 requests por hora.
    Implementando auth seria de 5000 requests por hora
*/
qacServices.existsOnGithub = function existsOnGithub(organization, project) {
    return Promises.start(function() {
        var params = {uri:'https://api.github.com/repos/'+organization+'/'+project, headers: { 'User-Agent': 'Request-Promise' }};
        //console.log("van params", params)
        return request(params);
    }).then(function(repo) {
        var proj = JSON.parse(repo);
        if(proj.message && proj.message.match(/not found/i)) {
            return {projNotFound:true};
        }
        return {};
    }).catch(function(err) {
        if(err.statusCode && err.statusCode !== 404) {
            throw new Error('github validation error', err.message);
        }
        return {projNotFound:true};
    });
};

qacServices.createProject = function createProject(organization, project) {
    var info;
    var projPath;
    var projects;
    return Promises.start(function() {
        if(!organization) { throw new Error('missing organization name'); }
        if(!project) { throw new Error('missing project name'); }
        if(! organization.match(reOrg)) {
            throw new Error('invalid organization name "'+organization+'"');
        }
        if(! project.match(reOrg)) {
            throw new Error('invalid project name "'+project+'"');
        }
        return qacServices.getInfo(organization);
    }).then(function(nfo) {
        info = nfo;
        projects = info.organization.projects;
        var projectFound=projects.filter(function(element, index, array) {
            return element.projectName==project;
        });
        if(projectFound.length) {
            throw new Error('duplicate project "'+project+'"');
        }
        return qacServices.existsOnGithub(organization, project);
    }).then(function(eog) {
        if(eog.orgNotFound) {
            throw new Error('inexistent organization on github ', organization);
        }
        if(eog.projNotFound) {
            throw new Error('inexistent project on github ', project);
        }
    }).then(function() {
        projects.push({projectName:project});
        return fs.writeJSON(info.organization.projectsJsonPath, projects);
    }).then(function() {
        projPath = Path.normalize(info.organization.path+'/projects/'+project);
        return fs.mkdir(projPath);
    }).then(function() {
        var folders=['result', 'info', 'params'/*, 'source'*/];
        return Promises.all(folders.map(function(folder) {
            return fs.mkdir(Path.normalize(projPath+'/'+folder));
        }));
    }).then(function() {
        return 'project "'+project+'" created';
    });
};

qacServices.deleteData = function deleteData(organization, project){
    return qacServices.getInfo(organization, project).then(function(info) {
        if(!!project) {
            var dirToRemove=Path.normalize(info.project.path);
            info.organization.projects = info.organization.projects.filter(function(p) {
                return p.projectName !== project;
            });
            return fs.writeJSON(info.organization.projectsJsonPath, info.organization.projects).then(function() {
                return fs.remove(dirToRemove);
            }).then(function(){
                return 'project "' + project +'" removed';
            });
        } else {
            var dirToRemove=Path.normalize(info.organization.path);
            return fs.remove(dirToRemove).then(function(){
                return 'organization "' + organization +'" removed';
            });
        }
    }).catch(function(err) {
        return err.message;
    });
};

function fixOrganizationInReq(req) {
    var repo=(req.body && req.body.repository) || {};
    if(repo.full_name && ! repo.organization){ // for de ping event
        repo.organization = repo.full_name.split('/')[0];
    }
    return repo;
}

function writePushStatus(info, data) {
    return writeJsonToFile(Path.normalize(info.project.path+'/result/push-status.json'), data)
}

function appendPushError(data) {
    var pushErrsFile = Path.normalize(qacServices.repository.path+'/groups/pushErrors.json');
    return fs.appendFile(pushErrsFile, JSON.stringify(data, null, 4), {encoding:'utf8'});
}

function WLF(msg) {
    fs.writeFileSync(Path.resolve('./_posted_data_.txt'), msg.trim()+"\n", {flag:'a'});
}

qacServices.logFatalError = function logFatalError(message, req) {
    var repo = fixOrganizationInReq(req);
    var logData = {
        date:dateForFileName(),
        message:message,
        status:'error'
    };
    function saveLog(repo, message) {
        return Promises.start(function() {
            if(repo.organization) {
                return qacServices.getInfo(repo.organization, repo.name);
            }
            return false;
        }).then(function(info) {
            if(info) {
                return writePushStatus(info, logData);
            } else {
                return appendPushError(logData);
            }
        }).catch(function(err){
            logData.message = err.message;
            logData.req = { headers: req.headers, body:req.body || 'null body' };
            return appendPushError(logData);
        });
    };
    saveLog();     
};

qacServices.receivePush = function receivePush(){
    return app.post(qacServices.rootUrl+'push/:organization/:project',function receivePushService(req,res){
        var eventType=req.headers['x-github-event'];
        if(!eventType){
            res.status(400);
            var msg = 'bad request. Missing X-GitHub-Event header';
            res.end(msg);
            qacServices.logFatalError(msg, req);
            return;
        }
        // validar request
        var githubSig = req.headers['x-hub-signature'];
        if(githubSig && ! qacServices.isValidRequest(JSON.stringify(req.body), githubSig, qacServices.repository.request_secret)) {
            res.status(403);
            var msg='unauthorized request. Invalid x-hub-signature';
            res.end(msg);
            qacServices.logFatalError(msg, req);
            return;
        }
        actualizeRepo(fixOrganizationInReq(req), res, (req.body.head_commit||{}).timestamp||(req.body.repository.pushed_at)||Date(), false);
    });
};

qacServices.receiveManualPush = function receiveManualPush(){
    // http://localhost:7226/refresh/codenautas/multilang?url=https://github.com/codenautas/multilang
    return app.get(qacServices.rootUrl+'refresh/:organization/:project',function receiveManualPushService(req,res){
        // validar request
        var repo={
            organization: req.params.organization, 
            name:         req.params.project,
            html_url:     req.query.url || 'https://github.com/'+req.params.organization+'/'+req.params.project
        };
        actualizeRepo(repo, res, Date(), true);
    });
};

function Feedback(res) {
    res.setHeader('Connection', 'Transfer-Encoding');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    //res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    //res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    //res.write('Pushing manually...<br>\n');
    this.msg = function(data) {
        res.write(data+'<br>\n');
    }
};

function NoFeedback() { this.msg = function() {} };

qacServices.doRepoUpdate = function doRepoUpdate(info, repo_url, feedback, bitacora) {
    var clonePath = Path.normalize(info.project.path+'/source');
    var resultsPath = Path.normalize(info.project.path+'/result');
    var cucardasFile = Path.normalize(clonePath+'/cucardas.log');
    var qaControlWarnings;
    
    return fs.stat(clonePath).then(function() {
        return true;
    }).catch(function(err) {
        if(err.code !== 'ENOENT') { 
            if(bitacora){
                bitacora.logAll('internal: exception', err);
                bitacora.finish();
            }
            throw err;
        }
        return false;
    }).then(function(mustDelete) {
        if(mustDelete){
            return fs.remove(clonePath);
        }
    }).then(function(){
        return execToHtml.run([{
            command:'git',
            params:['clone', '-q', repo_url+'.git', clonePath]
        }],{echo:true, exit:true}).onLine(function(lineInfo){
            feedback.msg(lineInfo.text);
            bitacora.log(lineInfo.origin, lineInfo.text);
        }).catch(function(err){
            console.log('-------------',err);
            throw err;
        });
    }).then(function() {
        return qaControl.controlProject(clonePath, {verbose:false, cucardas:true});
    }).then(function(warns) {
        qaControlWarnings = warns;
        bitacora.logAll('internal: qa-control',warns);
        bitacora.log('internal', 'qa-control-result: '+JSON.stringify(warns));
        return writeJsonToFile(Path.normalize(resultsPath+'/qa-control-result.json'), warns);
    }).then(function() {
        return fs.stat(cucardasFile).then(function(){
            return true;
        }).catch(function(err) {
            if(!err || err.code !== 'ENOENT') { throw err; }
            return false;
        });
    }).then(function(haveCucardas) {
        if(haveCucardas) {
            var cucardasMD = Path.normalize(resultsPath+'/cucardas.md');
            return fs.readFile(cucardasFile, {encoding:'utf8'}).then(function(content) {
                var cucardas = content.split('\n').splice(1);
                return fs.writeFile(cucardasMD, cucardas.join('\n'), {encoding:'utf8'});
            }).then(function() {
                bitacora.log('internal', '"'+cucardasMD+'" generated');
            });
        } else {
            bitacora.logAll('internal', 'Sin cucardas!!!');
        }
    }).then(function(){
        // procesar las warnings de qa-control
        var gravities = {
            error  :{count:0, label:'% err', color:'red'   },
            obs    :{count:0, label:'% obs', color:'yellow'},
            warning:{count:0, label:'% war', color:'orange'},
            notice :{count:0, label:'ok', color:'green'}, 
        }
        var scoreTypes = {
            cucardas   :{gravity:'warning'},
            multilang  :{gravity:'warning'},
            warning    :{gravity:'warning'},
            jshint     :{gravity:'obs'    },
            eslint     :{gravity:'obs'    },
            notice     :{gravity:'notice'},
            repository :{gravity:'error'  },
            conventions:{gravity:'error'  },
            mandatories:{gravity:'error'  },
            fatal      :{gravity:'error'  },
        }
        var qaControlLastVersion=true;
        qaControlWarnings.forEach(function(warn){
            //console.log(warn);
            warn.scoring = warn.scoring || {fatal:1};
            for(var scoreName in warn.scoring){
                gravities[(scoreTypes[scoreName]||scoreTypes.fatal).gravity].count+=warn.scoring[scoreName];
            }
        })
        var label;
        var color;
        for(var gravity in gravities){
            var county = gravities[gravity];
            if(!label && county.count){
                label=county.label.replace('%', county.count);
                color=county.color;
            }
        }
        //console.log((label?"OLDER":"LAST")+" version")
        if(!label){
            label='ok';
            color = 'brightgreen';
        }
        return request({uri:'https://img.shields.io/badge/qa--control-'+label+'-'+color+'.svg'});
    }).then(function(resp) {
        return fs.writeFile(Path.normalize(resultsPath+'/cucarda.svg'), resp, {encoding:'utf8'});
    }).then(function() {
        return writePushStatus(info, { date:dateForFileName(), status:'ok'} );
    }).then(function() {
        bitacora.finish();
    });
};

function bitacoraFor(info) {
    return new Bitacora(Path.normalize(info.project.path+'/info/'), Path.normalize(info.project.path+'/result/'));
};

function actualizeRepo(repo, res, timestamp, isManual){
    var info;
    var feedback = isManual ? new Feedback(res) : new NoFeedback();
    var bitacora;
    qacServices.getInfo(repo.organization, repo.name).then(function(nfo) {
        info = nfo;
        bitacora = bitacoraFor(info);
        return qacServices.doRepoUpdate(nfo, repo.html_url, feedback, bitacora);
    }).then(function() {
        return qacServices.getProjectLogs(info.project.path);
    }).then(function(logs) {
        if(! isManual) {
            res.end('ok: '+timestamp);
        } else {
            var content = html.html([qcsCommon.simpleHead('result.css', qacServices), html.body(logs)]);
            res.end(content.toHtmlDoc({pretty:true, title:repo.organization+' - '+repo.name+' qa-control'}));
        }
    }).catch(function(err) {
        console.log("qac-services.actualizeRepo err", err);
        console.log(err.stack);
        if(bitacora){
            bitacora.logAll('internal: exception', err);
            bitacora.finish();
        }
        if(err.statusCode){
            res.status(err.statusCode);
            res.end(err.message);
        }else{
            res.status(500);
            res.end("fatal error");
        }
    });
};

qacServices.getOrganizations = function getOrganizations(){
    var organizations=[];
    var repoPath = Path.normalize(qacServices.repository.path+'/groups');
    return Promises.start(function() {
        return fs.readdir(repoPath).catch(function(err) {
            if(err.code==='ENOENT') {
                var err2 = new Error('inexistent repository "'+repoPath+'"');
                err2.statusCode=404;
                throw err2;
            }
            throw err;
        }).then(function(files) {
            return Promises.all(files.map(function(file) {
                var fullPath = Path.normalize(repoPath+'/'+file);
                return fs.stat(fullPath).then(function(stat) {
                    if(stat.isDirectory()) {
                        organizations.push(file);
                    }
                });
            }));
        }).then(function() {
            return organizations.sort();
        });
    });
};

qacServices.isValidRequest = function isValidRequest(payload, keyInHeader, secret) {
    var hmac = crypto.createHmac('sha1', secret);
    hmac.setEncoding('hex');
    hmac.write(payload);
    hmac.end();
    var check = 'sha1='+hmac.read().toString('hex');
    var rv = check===keyInHeader;
    //console.log("secret", secret, "keyInHeader", keyInHeader, "result: ", rv, "check", check);
    return rv;
};

qacServices.staticServe = function staticServe(){
    return app.get(qacServices.rootUrl+':filename',function(req,res,next){
        if(req.params.filename.match(/(\.(css|jpg|png|gif|ico|js))$/)) {
            return res.sendFile(Path.resolve('./app/'+req.params.filename));
        }
        return next();
    });
};

qacServices.serveSVG = function serveSVG(organization, project){
    var project = project.substring(0, project.length-4);
    return qacServices.getInfo(organization, project).then(function(info) {
        return fs.readFile(Path.normalize(info.project.path+'/result/cucarda.svg'), 'utf8');
    }).catch(function(err) {
        if(err.code !== 'ENOENT') { throw err; }
        //console.log('No qa-control info for "'+project+'"');
        return qacServices.invalidSVG();
    }).then(function(isvg) {
        return isvg;
    });
};

qacServices.addParam = function addParam(elems, elem, name) {
    if(elem) { elems.push(html.input({type:'hidden', name:name, value:elem}));  }
};

qacServices.askServe = function askServe(){
    var thisModule = this;
    return app.use(thisModule.rootUrl+'ask',function(req,res){
        var elems = [
                    html.p({style:'color:gray'}, thisModule.rootUrl),
                    html.h2(["Proceed with: "+req.path+" ?"])
                ];
        var vars = req.path.split('/');
        qacServices.addParam(elems, vars[1], 'action');
        qacServices.addParam(elems, vars[2], 'organization');
        qacServices.addParam(elems, vars[3], 'project');
        elems.push(html.input({type:'submit', value:'Ok'}));
        var o=html.form({method:'post', action:thisModule.rootUrl},elems);
        miniTools.serveText(o.toHtmlDoc({title:'please confirm'}),'html')(req,res);
    });
};

qacServices.uriIsHandled = function uriIsHandled(req) {
    return req.params.organization.match(/^(login|admin|(manual-)?(delete|create|add))$/);
}

qacServices.noCacheHeaders = function noCacheHeaders(res, textType) {
    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    if(textType){
        res.header('Content-Type', 'text/'+textType+'; charset=utf-8');
    }
};

qacServices.organizationServe = function organizationServe(req){
    var thisModule = this;
    return app.get(thisModule.rootUrl+':organization',function(req,res,next){
        if(qacServices.uriIsHandled(req)) {
            return next();
        } else {
            thisModule.getOrganizationPage(req, req.params.organization).then(function(content){
                qacServices.noCacheHeaders(res, 'html');
                res.append('Content-Type', 'text/html');
                content = html.html([qcsCommon.simpleHead(null, qacServices), content]);
                res.end(content.toHtmlDoc({pretty:true, title:req.params.organization+' qa-control'}));
            }).catch(function(err) {
                console.log("organizationServe err", err);
                console.log("organizationServe stack", err.stack);
                res.statusCode=err.statusCode||500;
                res.end(res.statusCode+" Internal error:"+(!thisModule.production?err.message:''));
            }); 
        }
    });
};

qacServices.projectServe = function projectServe(){
    var thisModule = this;
    return app.get(thisModule.rootUrl+':organization/:project',function(req,res,next){
        if(qacServices.uriIsHandled(req)) {
            return next();
        } else {
            var isSvg=req.params.project.match(/(.svg)$/);
            var args = [req.params.organization, req.params.project];
            var action;
            if(isSvg) {
                action = thisModule.serveSVG;
            } else {
                args.unshift(req);
                action = thisModule.getProjectPage;
            }
            action.apply(this, args).then(function(content){
                qacServices.noCacheHeaders(res);
                if(isSvg) {
                    res.setHeader('Content-Type', 'image/svg+xml');
                    res.end(content);
                } else {
                    res.setHeader('Content-Type', 'text/html');
                    content = html.html([qcsCommon.simpleHead('result.css', qacServices), content]);
                    res.end(content.toHtmlDoc({pretty:true, title:req.params.organization+' - '+req.params.project+' qa-control'}));
                }
            }).catch(function(err) {
                return qacServices.naSVG();
            }).then(function(svg) {
                res.setHeader('Content-Type', 'image/svg+xml');
                res.end(svg);
            }); 
        }
    });
};

qacServices.createAndUpdateProject = function createAndUpdateProject(organization, project, feedback) {
    var creteProjMsg;
    return qacServices.createProject(organization, project).then(function(cpm) {
        feedback.msg(cpm);
        creteProjMsg = cpm;
        return qacServices.getInfo(organization, project);
    }).then(function(info) {
        return qacServices.doRepoUpdate(info, 'https://github.com/'+organization+'/'+project, feedback, bitacoraFor(info));
    }).then(function() {
       return creteProjMsg; 
    }).catch(function(err) {
        console.log("doRepoUpdate err", err.stack);
        throw err;
    });
};

function handleAbms(thisModule, url, method, pref) {
    this.url = url;
    this.handle = function(req, res, next) {
        var vars = method === 'post' ? req.body : req.params;
        if(req.session===undefined){
            console.log('****************** req.session undefined');
        }
        thisModule.users = thisModule.setSession(req);
        console.log("USERS", qacServices.users);
        var doAction=null;
        switch(vars.action) {
            case pref+'delete': doAction = thisModule.deleteData; break;
            case pref+'add': doAction = thisModule.createAndUpdateProject; break;
            case pref+'create': doAction = thisModule.createOrganization;  break; // ignora vars.project
        }
        if(! doAction) { return next(); }
        doAction(vars.organization, vars.project, pref !== '' ? new Feedback(res) : new NoFeedback()).then(function(content) {
            res.end(content); 
        }).catch(function(err) {
            res.end(err.message)
        });
    };
};

qacServices.abmsManualServe = function abmsManualServe() {
    console.log("------------- abmsManualServe --------------");
    var handler = new handleAbms(this, qacServices.rootUrl+':action/:organization/:project?', 'get', 'manual-');
    return app.get(handler.url, handler.handle);
};

qacServices.md5Prefixed = function md5Prefixed(text){
    return 'md5.'+crypto.createHash('md5').update(text).digest('hex');
};

qacServices.enableLoginPlus = function enableLoginPlus(usersDatabasePath) {
    if(! usersDatabasePath) {
        throw new Error('must provide path to users database');
    }
    if(! fs.existsSync(usersDatabasePath)) {
        throw new Error('users database not found ['+usersDatabasePath+']');
    }
    loginPlus.init(app,{
        successRedirect:qacServices.rootUrl+'admin',
        unloggedPath:Path.normalize(__dirname+'/../app'),
        loginPagePath:Path.normalize(__dirname+'/../app/login'),
        loginUrlPath:qacServices.rootUrl+'login',
    });
    loginPlus.setValidator(
        function(username, password, done) {
            var users;
            fs.readJson(usersDatabasePath).then(function(json) {
                users = json;
            }).then(function() {
                var user = users[username];
                if(!!user && ! user.locked && user.pass == qacServices.md5Prefixed(password+username)) {
                    done(null, {username: username, when: Date()});
                } else {
                    done('Unauthorized');
                }
            }).catch(function(err){
                console.log('error logueando',err);
                console.log('stack',err.stack);
                throw err;
            }).catch(done);
        }
    );
};

qacServices.abmsServe = function abmsServe() {
    var handler = new handleAbms(this, qacServices.rootUrl, 'post', '');
    return app.post(handler.url, handler.handle);
};

qacServices.adminServe = function adminServe(){
    var thisModule = this;
    return app.get(qacServices.rootUrl+'admin',function(req,res,next){
        thisModule.users = thisModule.setSession(req);
        thisModule.getAdminPage(req).then(function(content){
            qacServices.noCacheHeaders(res, 'html');
            res.append('Content-Type', 'text/html');
            content = html.html([qcsCommon.simpleHead(null, thisModule), content]);
            res.end(content.toHtmlDoc({pretty:true, title:'admin qa-control'}));
        }).catch(function(err) {
            console.log("adminServe err", err);
            console.log("adminServe stack", err.stack);
            res.statusCode=err.statusCode||500;
            res.end(res.statusCode+" Internal error:"+(!thisModule.production?err.message:''));
        }); 
    });
};

module.exports=qacServices;