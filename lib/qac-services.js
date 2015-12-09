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
var loginPlus = require('login-plus');
var cookieParser = require('cookie-parser');
var qcsCommon = require('./qcs-common.js');
var miniTools = require('mini-tools');
var html = require('js-to-html').html;
html.insecureModeEnabled = true;

function md5Prefixed(text){
    return 'md5.'+crypto.createHash('md5').update(text).digest('hex');
}

function noCacheHeaders(res) {
    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
}

// markdown render
var marked = require("marked");
marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    highlightx: function (code, lang, callback) {
        require('pygmentize-bundled')({ lang: lang, format: 'html' }, code, function (err, result) {
            callback(err, result.toString());
        });
    },
    highlight: function(code){
        return require('highlight.js').highlightAuto(code).value;
    }
});

var markdownRender=function markdownRender(content){
    return Promises.make(function(resolve, reject){
        marked(content,function(err,ok){
            if(err){
                reject(err);
            }else{
                // resolve(qcsCommon.simpleHtml(
                    // 'QA Control Server',
                    // html.article({'class':'markdown-body entry-content', 'itemprop':'mainContentOfPage'}, ok),
                    // '/result.css'
                // ));
                resolve(qcsCommon.simpleHtml(
                    'QA Control Server',
                    [ html.includeHtml(
                        '<article class="markdown-body entry-content" itemprop="mainContentOfPage">'+ok+'</article>'
                    ) ],
                    '/result.css'
                ));
            }
        });
    });
};

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
    //console.log("qacServices.config <- opts", opts, production);
    if(production == null){
        throw new Error("must set 'production' in config");
    }
    if(opts && opts.repository) {
		qacServices.repository = opts.repository;
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
        cucardasHtml.push([]);
    }
    return cucardasHtml.map(function(cucardasOnePosition){
        return html.td(cucardasOnePosition);
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
    return html.a({href:qacServices.rootUrl+organization+'/'+project}, project);
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
                //console.log("projectFound", projectFound, project)
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
                    return {isDirectory: function() { return false; }};
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

function makeInput(type, value, oclick, name) {
    var attrs = {type:type};
    if(value) { attrs.value=value; }
    if(oclick) { attrs.onClick=oclick; }
    if(name) { attrs.name = name; }
    return html.input(attrs).toHtmlText({pretty:true});
};

function makeButton(title, link, confirmMsg) {
    var oclick = "if(confirm('"+confirmMsg+"?')) { this.form.action='"+link+"'; this.form.submit(); }"; 
    return makeInput('button', title, oclick);
};

qacServices.orgActionButtons = function orgActionButtons(organization){
    var tds=[];
    if(qacServices.user) {
        tds.push(html.td([
            html.a({
                href: qacServices.rootUrl+'ask/delete/'+organization,
                'codenautas-confirm': 'row'
            },[html.img({src:'/delete.png', alg:'del', style:'height:18px'})])
        ]))
    }
    return tds;
}

qacServices.projectActionButtons = function projectActionButtons(organization, project){
    var tds=[];
    if(qacServices.user) {
        tds.push(html.td([
            html.a({
                href: qacServices.rootUrl+'ask/delete/'+organization+'/'+project,
                'codenautas-confirm': 'row'
            },[html.img({src:'/delete.png', alg:'del', style:'height:18px'})])
        ]))
    }
    if(qacServices.user && !qacServices.production){
        tds.push(html.td([
            html.a({
                href:qacServices.rootUrl+'manual-push/'+organization+'/'+project
            }, [html.img({src:'/refresh.png', alt:'rfrsh', style:'height:18px'})])
        ]));
    }
    return tds;
}

qacServices.orgAddButton = function orgAddButton(){
    var ret=[];
    if(qacServices.user) {
        ret.push(
            html.input({type:'hidden', name:'action',       value:'create'}),
            html.input({type:'text',   name:'organization'}),
            html.input({type:'submit', value:'New organization...'})
        )
    }
    return ret;
};

qacServices.projectAddButton = function projectAddButton(organization){
    var ret=[];
    if(qacServices.user) {
        ret.push(
            html.input({type:'hidden', name:'action',       value:'add'}),
            html.input({type:'hidden', name:'organization', value:organization}),
            html.input({type:'text',   name:'project'}),
            html.input({type:'submit', value:'New project...'})
        )
    }
    return ret;
}

function getProject(info, project) {
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
        tds = tds.concat(qacServices.projectActionButtons(organization, project.projectName));
        return html.tr(tds);
    });
};

qacServices.getOrganizationPage = function getOrganizationPage(organization){
    return qacServices.getInfo(organization).then(function(info) {
        if(info.organization.projects.length) {
            return Promises.all(info.organization.projects.map(function(project) {
                return getProject(info, project);
            })).then(function(trs) {
                var tds = [ html.th('project'), html.th({colspan:qacServices.cucardasToHtmlList.order._OTHERS_-1},'cucardas')];
                if(qacServices.user) {
                    tds.push(html.th({colspan:4},'actions'));
                }
                var all_trs = [ html.tr(tds)];
                for(var tr in trs) { all_trs.push(trs[tr]); }
                if(qacServices.user) {
                    all_trs.push(html.tr([html.td({colspan:qacServices.cucardasToHtmlList.order._OTHERS_+(1+4), align:'right'}, qacServices.projectAddButton(organization))]));
                }
                if(qacServices.user) {
                    return html.form({method:'post', action:qacServices.rootUrl}, [html.table(all_trs)]);
                } else {
                    return html.table(all_trs);
                }
            });
        } else {
            if(qacServices.user) {
                return html.form({method:'post', action:qacServices.rootUrl}, [html.table([html.tr([html.td(qacServices.projectAddButton(organization))])])]);
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
                trs.push(html.tr([
                            html.td([reg.warning]),
                            html.td([reg.params ? reg.params.join(',') : '']),
                            html.td([reg.scoring.customs])
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

qacServices.getProjectPage = function getProjectPage(organization, project){
    var pageCont;
    var info;
    return qacServices.getInfo(organization, project).then(function(nfo) {
        info = nfo;
        // console.log("INFO in getProjectPage", info);
        return getProject(info, {projectName:project});
    }).then(function(projTR) {
        var tds = [ html.th('project'), html.th({colspan:qacServices.cucardasToHtmlList.order._OTHERS_-1},'cucardas')];
        //console.log("user", qacServices.user);
        if(qacServices.user) {
            tds.push(html.th({colspan:4},'actions'));
        }
        var all_trs = [ html.tr(tds), projTR];
        if(qacServices.user) {
            return html.form({method:'post', action:qacServices.rootUrl}, html.table(all_trs));
        } else {
            return html.table(all_trs);
        }
    }).then(function(content) {
        pageCont = content;
        return qacServices.user ? qacServices.getProjectLogs(info.project.path) : false;
    }).then(function(logs) {
        if(logs) {
            //console.log("logs", logs);
            logs.unshift(pageCont);
            return logs;
        }
        return [pageCont];
    }).then(function(content) {
        //console.log("getProjectPage content ------------- "+typeof(content), content);
        return html.body(content);
    }).catch(function(err) {
        console.log("getProjectPage err", err);
        console.log("getProjectPage stack", err.stack);
    });
};

qacServices.getAdminPage = function getAdminPage(){
    return qacServices.getOrganizations().then(function(orgs) {
        if(orgs.length) {
            return Promises.all(orgs.map(function(org) {
                var tds = [];
                tds.unshift(html.td([qacServices.orgNameToHtmlLink(org)]));
                tds = tds.concat(qacServices.orgActionButtons(org));
                return html.tr(tds);
            })).then(function(trs) {
                var tds = [html.th('organization')];
                if(qacServices.user) {
                    tds.push(html.th('actions'));
                }
                var all_trs = [ html.tr(tds)];
                for(var tr in trs) { all_trs.push(trs[tr]); }
                if(qacServices.user) {
                    all_trs.push(html.tr([html.td({colspan:2, align:'right'}, qacServices.orgAddButton())]));
                }
                if(qacServices.user) {
                    return html.form({method:'post', action:qacServices.rootUrl}, [html.table(all_trs)]);
                } else {
                    return html.table(all_trs);
                }
            });
        } else {
            return html.table([html.tr([html.td('There are no organizations')])]);
        }
    });
};

function json2file(filePath, jsonData) {
    return fs.writeFile(filePath, JSON.stringify(jsonData, null, 4), {encoding:'utf8'});
}

function Bitacora(pathInfo, pathBita) {
    this.data = [];
    this.now = function() {
        var d=new Date().toJSON().replace(/:/g,'').replace('T','_');//.replace(/-/g, '');
        return d.substr(0, d.length-5);
    };
    this.logAll = function(type, data) {
        //console.log("logAll", type, data);
        this.data.push({date:this.now(), type:type, data:data});
    };
    this.log = function(origin, text) {
        //console.log("log", origin, text);
        this.data.push({date:this.now(), origin:origin, text:text});
    };
    this.finish = function() {
        function isBitacora(obj) { return 'origin' in obj; }
        function isAll(obj) { return ! isBitacora(obj); }
        var logs = this.data;
        //console.log("------------ todo -----------", logs);
        var fileBita = logs.filter(isBitacora);
        var vNow = this.now();
        json2file(pathBita+'bitacora.json', fileBita).then(function() {
            var fileAll = logs.filter(isAll);
            return json2file(pathInfo+'bitacora_'+vNow+'.json', fileAll);
        }).then(function() {
            //console.log("bitacora guardada");
        }).catch(function(err) {
            console.log("bitacora ERROR", err.stack);
        });
    };
};

qacServices.invalidSVG = function invalidSVG() {
    return fs.readFile('./resources/qa--control-invalid-lightgrey.svg', 'utf8').then(function(isvg) {
       return isvg;
    });
};

qacServices.invalidPage = function invalidPage() {
    return qacServices.invalidSVG().then(function(isvg) {
       return markdownRender(isvg);
    });
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

function gitHubUrl(p1, p2) {
    return {uri:'https://api.github.com/'+p1+'/'+p2+'/repos', headers: { 'User-Agent': 'Request-Promise' }};
};

/*
    ver https://developer.github.com/v3/#rate-limiting
    Cuando se supera este limite github devuelve 403 y esta funcion falla
    porque el request no es autenticado y el limite es de 60 requests por hora.
    Implementando auth seria de 5000 requests por hora
*/
qacServices.existsOnGithub = function existsOnGithub(organization, project) {
    return Promises.start(function() {
        return request(gitHubUrl('orgs', organization));
    }).catch(function(err) {
        //console.log("gh 1", err);
        if(err.statusCode && err.statusCode !== 404) {
            throw new Error('github validation error', err.message);
        }
        return request(gitHubUrl('users', organization));
    }).catch(function(err) {
        //console.log("gh 2", err.statusCode);
        return {orgNotFound:true};
    }).then(function(repos) {
        if(repos.orgNotFound) { return repos; }
        //console.log("Llega repos", repos);
        var projs = JSON.parse(repos);
        var mr = projs.filter(function(repo) {
            return repo.name === project;
        });
        if(! mr.length) {
            return {projNotFound:true};
        }
        return {};
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
        //console.log("info", info.organization.projects);
        if(!!project) {
            var dirToRemove=Path.normalize(info.project.path);
            info.organization.projects = info.organization.projects.filter(function(p) {
                return p.projectName !== project;
            });
            //console.log("info.organization.projects", info.organization.projects);
            return fs.writeJSON(info.organization.projectsJsonPath, info.organization.projects).then(function() {
                return fs.remove(dirToRemove);
            }).then(function(){
                return 'project "' + project +'" removed';
            });
        } else {
            var dirToRemove=Path.normalize(info.organization.path);
            return fs.remove(dirToRemove).then(function(){
                //console.log("removed directory", dirToRemove);
                return 'organization "' + organization +'" removed';
            });
        }
    }).catch(function(err) {
        console.log("manageDeletes error", err.stack);
        return err.message;
    });
};

qacServices.receivePush = function receivePush(){
    return app.post(qacServices.rootUrl+'push/:organization/:project',function receivePushService(req,res){
        var eventType=req.headers['x-github-event'];
        if(!eventType){
            res.status(400);
            res.end('bad request. Missing X-GitHub-Event header');
            return;
        }
        // validar request
        var githubSig = req.headers['x-hub-signature'];
        if(githubSig && ! qacServices.isValidRequest(JSON.stringify(req.body), githubSig, qacServices.repository.request_secret)) {
            res.status(403);
            res.end('unauthorized request. Invalid x-hub-signature');
            return;
        }
        // guardar en base de datos
        var repo=req.body.repository;
        actualizeRepo(repo, res, req.body.head_commit.timestamp);
    });
};

qacServices.receiveManualPush = function receiveManualPush(){
    // http://localhost:7226/manual-push/codenautas/multilang?url=https://github.com/codenautas/multilang
    return app.get(qacServices.rootUrl+'manual-push/:organization/:project',function receiveManualPushService(req,res){
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
        //console.log('ERROR fs.stat', err, err.code);
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
        //console.log("warns", warns);
        bitacora.logAll('internal: qa-control',warns);
        bitacora.log('internal', 'qa-control-result: '+JSON.stringify(warns));
        return json2file(Path.normalize(resultsPath+'/qa-control-result.json'), warns);
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
        var numErrs = 0;
        for(var w in qaControlWarnings) {
            numErrs++;
        }
        var label = 'ok', color='green';
        if(numErrs) {
            label = numErrs+' err';
            if(numErrs<5) {
                color = 'yellow';
            } else if(numErrs <10) {
                color = 'orange';
            } else {
                color = 'red';
            }
            //console.log("color", color);
        }
        return request({uri:'https://img.shields.io/badge/qa--control-'+label+'-'+color+'.svg'});
    }).then(function(resp) {
        //console.log("resp", resp);
        return fs.writeFile(Path.normalize(resultsPath+'/cucarda.svg'), resp, {encoding:'utf8'});
    }).then(function() {
        bitacora.finish();
        //console.log("bitacora", bitacora);
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
        res.write('ok: '+timestamp)
        res.end();
        //console.log("bitacora", bitacora);
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
            //console.log("files", files);
            Promises.all(files.map(function(file) {
                //organizations.push({ name:file, path:Path.normalize(repoPath+'/'+file) });
                organizations.push(file);
            }));
        }).then(function() {
            return organizations;
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
            //console.log("STATIC", req.params.filename);
            return res.sendFile(Path.resolve('./app/'+req.params.filename));
        }
        return next();
    });
};

qacServices.makeOverviewMd = function makeOverviewMd(organization, project){
    return qacServices.getInfo(organization, project).then(function(info) {
        var header = 'Project|Cucardas'+(qacServices.user?'|Actions':'')+
            '\n---|---'+(qacServices.user?'|:---:':'')+'\n';
        if(!!project) {
            var resultsDir = Path.normalize(info.project.path+'/result/');
            var r='';
            return fs.readFile(resultsDir+'cucardas.md', 'utf8').catch(function(err) {
                if(err.code !== 'ENOENT') { throw err; }
                return qacServices.invalidSVG();
            }).then(function(content){
                r = project+'|'+content.split('\n').join(' ');
                if(qacServices.user) {
                    r += '|'+makeButton('Delete', qacServices.rootUrl+'delete/'+organization+'/'+project, 'Delete project \\\''+project+'\\\'')
                }
                if(qacServices.user && !qacServices.production){
                    r +=' [refresh]('+qacServices.rootUrl+'manual-push/'+organization+'/'+project+')';
                }
                r = header+r+'\n';
                
                return fs.readJSON(Path.normalize(info.project.path+'/result/qa-control-result.json'), 'utf8');
            }).catch(function(err) {
                if(err.code !== 'ENOENT') { throw err; }
                return [];
            }).then(function(qac) {
                if(qac.length) {
                    r += '\n##### QA Control result\n|warning|file(s)|scoring\n|---|---|---\n';
                    for(var b in qac) {
                        var reg = qac[b]
                        r += '|' + reg.warning + '|' + (reg.params ? reg.params.join(',') : '') + '|' + reg.scoring.customs + '\n'; 
                    }
                    r += '\n';
                }
                return fs.readJSON(Path.normalize(info.project.path+'/result/bitacora.json'), 'utf8');
            }).catch(function(err) {
                if(err.code !== 'ENOENT') { throw err; }
                return [];
            }).then(function(bita) {
                if(bita.length) {
                    r += '\n|Actions log\n|---\n';
                    for(var b in bita) {
                        var reg = bita[b];
                        var cls = 'stdout';
                        if(reg.origin==='internal') {
                            cls = 'internal';
                        } else if(reg.origin.match(/^(shell)/)) {
                            cls = 'shell';
                        }
                        r += '|'+html.div({class:cls}, reg.text.trim()).toHtmlText({pretty:true})
                    }
                }
                return r;
            });
        } else {
            var buttonAddProject = '';
            if(qacServices.user) {
                var oclick = 'var p=this.form.project; var org=this.form.organization.value;'
                            +' if(p.value != \'\') { this.form.action=\''+qacServices.rootUrl+'add/\'+org+\'/\'+p.value;'
                            +' this.form.submit(); }'
                            +' else { p.focus(); }';
                buttonAddProject='\n\n|New project\n|:---:\n|'
                                +makeInput('hidden', organization, null, 'organization')
                                +makeInput('text', null, null, "project")
                                +'&nbsp;&nbsp;'
                                +makeInput('button','Create...',oclick)+'\n';

            }
            if(info.organization.projects.length) {
                return Promises.all(info.organization.projects.map(function(project) {
                    return fs.readFile(Path.normalize(info.organization.path+'/projects/'+project.projectName+'/result/cucardas.md'), 'utf8').catch(function(err) {
                        if(err.code !== 'ENOENT') { throw err; }
                        return qacServices.invalidSVG();
                    }).then(function(content){
                        var r = '['+project.projectName+']('+(qacServices.rootUrl+organization+'/')+project.projectName+') '+'|'+content.split('\n').join(' ');
                        if(!/\[qa-control\]/.test(r)){
                            r += '[![qa-control]('+(qacServices.rootUrl+organization+'/')+project.projectName+'.svg)]('+(qacServices.rootUrl+organization+'/')+project.projectName+')'
                        }
                        if(qacServices.user) {
                            r += '|' + makeButton('Delete', qacServices.rootUrl+'delete/'+organization+'/'+project.projectName, 'Delete project \\\''+project.projectName+'\\\'')
                        }
                        if(qacServices.user && !qacServices.production){
                            r +=' [refresh]('+qacServices.rootUrl+'manual-push/'+organization+'/'+project.projectName+')';
                        }
                        return r;
                    });
                })).then(function(contents){
                    var ret = header+contents.join('\n')+buttonAddProject;
                    //fs.writeFileSync("_pppp_.log", ret, 'utf8');
                    return ret;
                });                
            } else {
                return buttonAddProject;
            }
        }
    });
};

qacServices.makeOverviewHtml = function makeOverviewHtml(organization, project){
    return qacServices.makeOverviewMd(organization, project).then(function(content) {
        return markdownRender('<em><form method="post"></em>\n\n'+content+'\n<em></form></em>');
    });
};

qacServices.serveSVG = function serveSVG(organization, project){
    var project = project.substring(0, project.length-4);
    return qacServices.getInfo(organization, project).then(function(info) {
        //console.log("---------------------------- info", info);
        return fs.readFile(Path.normalize(info.project.path+'/result/cucarda.svg'), 'utf8');
    }).catch(function(err) {
        if(err.code !== 'ENOENT') { throw err; }
        console.log('No qa-control info for "'+project+'"');
        return qacServices.invalidSVG();
    }).then(function(isvg) {
        //console.log("isvg", isvg);
        return isvg;
    });
};

function addParam(elems, elem, name) {
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
        addParam(elems, vars[1], 'action');
        addParam(elems, vars[2], 'organization');
        addParam(elems, vars[3], 'project');
        elems.push(html.input({type:'submit', value:'Ok'}));
        var o=html.form({method:'post', action:thisModule.rootUrl},elems);
        miniTools.serveText(o.toHtmlDoc({title:'please confirm'}),'html')(req,res);
    });
};

function uriIsHandled(req) {
    return req.params.organization.match(/^(login|admin|(manual-)?(delete|create|add))$/);
}

qacServices.organizationServe = function organizationServe(){
    var thisModule = this;
    return app.get(thisModule.rootUrl+':organization',function(req,res,next){
        if(uriIsHandled(req)) {
            return next();
        } else {
            thisModule.getOrganizationPage(req.params.organization).then(function(content){
                noCacheHeaders(res);
                content = html.html([qcsCommon.simpleHead(), content]);
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
        if(uriIsHandled(req)) {
            return next();
        } else {
            var isSvg=req.params.project.match(/(.svg)$/);
            var action = isSvg ? thisModule.serveSVG : thisModule.getProjectPage;
            action(req.params.organization, req.params.project).then(function(content){
                noCacheHeaders(res);
                if(isSvg) {
                    res.setHeader('Content-Type', 'image/svg+xml');
                    res.end(content);
                } else {
                    console.log("projectServe content", content);
                    content = html.html([qcsCommon.simpleHead('/result.css'), content]);
                    res.end(content.toHtmlDoc({pretty:true, title:req.params.organization+' - '+req.params.project+' qa-control'}));
                }
            }).catch(function(err) {
                console.log("projectServe err", err);
                console.log("projectServe stack", err.stack);
                res.statusCode=err.statusCode||500;
                res.end(res.statusCode+" Internal error:"+(!thisModule.production?err.message:''));
            }); 
        }
    });
};

qacServices.overviewServe = function overviewServe(){
    var thisModule = this;
    return app.get(qacServices.rootUrl+':organization/:project?',function(req,res,next){
        if(uriIsHandled(req)) {
            return next();
        } else {
            var isSvg=!!req.params.project && req.params.project.match(/(.svg)$/);
            var action = isSvg ? thisModule.serveSVG : thisModule.makeOverviewHtml;
            action(req.params.organization, req.params.project).then(function(content){
                noCacheHeaders(res);
                if(isSvg){
                    res.setHeader('Content-Type', 'image/svg+xml');
                }
                res.end(content);          
            }).catch(function(err) {
                console.log("overviewServe err", err);
                console.log("overviewServe stack", err.stack);
                res.statusCode=err.statusCode||500;
                res.end(res.statusCode+" Internal error:"+(!qacServices.production?err.message:''));
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
        console.log("Tengo info", info);
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
        console.log("vars", vars);
        if(req.session===undefined){
            console.log('****************** req.session undefined');
        }
        thisModule.user = (req.session||{passport:{}}).passport.user;
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

qacServices.enableLoginPlus = function enableLoginPlus() {
    console.log('++++++++++++loginPlus');
    loginPlus.init(app,{
        successRedirect:qacServices.rootUrl+'admin',
        unloggedPath:Path.normalize(__dirname+'/../app'),
        loginPagePath:Path.normalize(__dirname+'/../app/login')
    });
    loginPlus.setValidator(
        function(username, password, done) {
            var users;
            fs.readJson('./app/users.json').then(function(json) {
                users = json;
                //console.log("users", users);
            }).then(function() {
                var user = users[username];
                if(!!user && ! user.locked && user.pass == md5Prefixed(password+username)) {
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
        thisModule.user = (req.session||{passport:{}}).passport.user;
        thisModule.getAdminPage().then(function(content){
            noCacheHeaders(res);
            content = html.html([qcsCommon.simpleHead(), content]);
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