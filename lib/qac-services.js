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

qacServices.cucardasToHtmlList = function cucardasToHtmlList(cucardas) {
    var cucas = cucardas.split(/\s+/);
    var rv = [];
    var e_link = '(https?://[^)]+)';
    var e_alt = '!\\[([^\\]]+)]\\('+e_link+'\\)';
    var re = new RegExp('(?:'+e_alt+'|\\['+e_alt+']\\('+e_link+'\\))');
    for(var c=0; c<cucas.length; ++c) {
        var cuca = cucas[c].match(re);
        if(cuca) {
            //console.log("MATCH", cucas[c]);
            if(cuca[1]) {
                rv.push(html.img({src:cuca[2], alt:cuca[1]}))
            } else {
                rv.push( html.a( {href:cuca[5]}, [ html.img({src:cuca[4], alt:cuca[3]}) ]) )
            }
        }
    }
    return rv;
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

function makeButton(title, link, method, confirmMsg) {
    var sendLink = "this.form.method='"+method+"'; this.form.action='"+link+"';";
    sendLink += " this.form.submit();";
    var oclick = !!confirmMsg ? "if(confirm('"+confirmMsg+"?')) { "+sendLink+" }" : sendLink; 
    return makeInput('button', title, oclick);
};

qacServices.getOrganizationPage = function getOrganizationPage(organization){
    return qacServices.getInfo(organization).then(function(info) {
        if(info.organization.projects.length) {
            return Promises.all(info.organization.projects.map(function(project) {
                return fs.readFile(Path.normalize(info.organization.path+'/projects/'+project.projectName+'/result/cucardas.md'), 'utf8').catch(function(err) {
                    if(err.code !== 'ENOENT') { throw err; }
                    return qacServices.invalidSVG();
                }).then(function(content){
                    var tds = [
                                html.td(qacServices.projectNameToHtmlLink(organization, project.projectName)),
                                html.td(qacServices.cucardasToHtmlList(content))
                              ];
                    if(qacServices.user) {
                        // tds.push(html.td(makeButton('Delete', qacServices.rootUrl+'delete/'+organization+'/'+project.projectName,
                                            // 'post', 'Delete project \\\''+project.projectName+'\\\'')));
                        tds.push(html.td('Delete'));
                    }
                    return html.tr(tds);
                });
            })).then(function(trs) {
                var tds = [ html.th('project'), html.th('cucardas')];
                if(qacServices.user) {
                    tds.push(html.th('actions'));
                }
                var all_trs = [ html.tr(tds)];
                for(var tr in trs) { all_trs.push(trs[tr]); }
                if(qacServices.user) {
                    return html.form([html.table(all_trs)]);
                } else {
                    return html.table(all_trs);
                }
            });
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
    return fs.readFile('./resources/qa--control-invalid-lightgrey.svg', 'utf8').then(function(svg) {
       return svg;
    });
};

qacServices.invalidPage = function invalidPage() {
    return qacServices.invalidSVG().then(function(svg) {
       return markdownRender(svg);
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

qacServices.createProject = function createProject(organization, project) {
    var info;
    var projPath;
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
        //console.log(info);
        var projects = info.organization.projects;
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
    res.write('Pushing manually...<br>\n');
    this.msg = function(data) {
        res.write(data+'<br>\n');
    }
};

function NoFeedback() { this.msg = function() {} };

function actualizeRepo(repo, res, timestamp, isManual){
    var info;
    var clonePath, resultsPath;
    var bitacora = null;
    var cucardasFile;
    var qaControlWarnings;
    var feedback = isManual ? new Feedback(res) : new NoFeedback();    
    qacServices.getInfo(repo.organization, repo.name).then(function(nfo) {
        info = nfo;
        clonePath = Path.normalize(info.project.path+'/source');
        resultsPath = Path.normalize(info.project.path+'/result');
        cucardasFile = Path.normalize(clonePath+'/cucardas.log');
        bitacora = new Bitacora(Path.normalize(info.project.path+'/info/'), Path.normalize(resultsPath+'/'));
        //bitacora.logAll('internal: payload', req.body);
        return fs.stat(clonePath);
    }).then(function() {
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
        var gitCmd = 'git clone '+repo.html_url+'.git '+clonePath 
        return execToHtml.run([{
            command:'git',
            params:['clone',repo.html_url+'.git',clonePath]
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

function makeInput(type, value, oclick, name) {
    var attrs = {type:type};
    if(value) { attrs.value=value; }
    if(oclick) { attrs.onClick=oclick; }
    if(name) { attrs.name = name; }
    return html.input(attrs).toHtmlText({pretty:true});
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
                    r += '|'+makeButton('Delete', qacServices.rootUrl+'delete/'+organization+'/'+project, 'post', 'Delete project \\\''+project+'\\\'')
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
                        r += '|' + reg.warning + '|' + reg.params.join(',') + '|' + reg.scoring.customs + '\n'; 
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
                            +' this.form.method = \'post\'; this.form.submit(); }'
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
                        if(qacServices.user) {
                            r += '|' + makeButton('Delete', qacServices.rootUrl+'delete/'+organization+'/'+project.projectName, 'post', 'Delete project \\\''+project.projectName+'\\\'')
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
        return markdownRender('<em><form></em>\n\n'+content+'\n<em></form></em>');
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
    }).then(function(svg) {
        //console.log("svg", svg);
        return markdownRender(svg);
    });
};


qacServices.overviewServe = function overviewServe(){
    var thisModule = this;
    return app.get(qacServices.rootUrl+':organization/:project?',function(req,res,next){
        if(req.params.organization.match(/(.(css|jpg|png|gif|ico))$/)) {
            return res.sendFile(Path.resolve('./app/'+req.params.organization));
        } else if(req.params.organization.match(/^(login|admin|(manual-)?(delete|create|add))$/)) {
            return next();
        } else {
            var action = (!!req.params.project && req.params.project.match(/(.svg)$/)) ?
                            thisModule.serveSVG :
                            thisModule.makeOverviewHtml;
            action(req.params.organization, req.params.project).then(function(content){
                noCacheHeaders(res);
                res.end(content);                
            }).catch(function(err) {
                console.log("overviewServe err", err);
                res.statusCode=err.statusCode||500;
                res.end(res.statusCode+" Internal error:"+(!qacServices.production?err.message:''));
            }); 
        }
    });
};

function handleAbms(thisModule, pref) {
    this.url = qacServices.rootUrl+':action/:organization/:project?';
    this.handle = function(req, res, next) {
        thisModule.user = req.session.passport.user;
        var doAction=null;
        switch(req.params.action) {
            case pref+'delete': doAction = thisModule.deleteData; break;
            case pref+'add': doAction = thisModule.createProject; break;
            case pref+'create': doAction = thisModule.createOrganization;  break; // ignora req.params.project
        }
        if(! doAction) { return next(); }
        doAction(req.params.organization, req.params.project).then(function(content) {
            res.end(content); 
        }).catch(function(err) {
            res.end(err.message);
        });
    };
};

qacServices.abmsManualServe = function abmsManualServe() {
    console.log("------------- abmsManualServe --------------");
    var handler = new handleAbms(this, 'manual-');
    return app.get(handler.url, handler.handle);
};

qacServices.enableLoginPlus = function enableLoginPlus() {
    loginPlus.init(app,
            {successRedirect:qacServices.rootUrl+'admin'
            ,unloggedPath:Path.normalize(__dirname+'/../app')
            ,loginPagePath:Path.normalize(__dirname+'/../app/login')
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
    var handler = new handleAbms(this, '');
    return app.post(handler.url, handler.handle);
};

qacServices.adminServe = function adminServe() {
    var thisModule = this;
    return app.get(qacServices.rootUrl+'admin', function(req,res,next){
        thisModule.user = req.session.passport.user;
        qacServices.getOrganizations().then(function(orgs) {
            var out='<em><form></em>\n\n';
            out += 'Organizations|Actions\n---|:---:\n';
            for(var o=0; o<orgs.length; ++o) {
                var org = orgs[o];
                out += '['+org+']('+org+') '
                       + '|' +makeButton('Delete', qacServices.rootUrl+'delete/'+org, 'post', 'Delete organization \\\''+org+'\\\'')+'\n';
            }
            var oclick = 'var o=this.form.organization;'
                        +' if(o.value != \'\') { this.form.action=\''+qacServices.rootUrl+'create/\'+o.value;'
                        +' this.form.method = \'post\'; this.form.submit(); }'
                        +' else { o.focus(); }';
            out += '\n|New organization\n|:---:\n|'+makeInput('text', null, null, 'organization')+'&nbsp;&nbsp;'+makeInput('button', "Create...", oclick)+'\n';
            out += '\n<em></form></em>';
            return markdownRender(out);
        }).then(function(content) {
            noCacheHeaders(res);
            res.end(content);
        });
        //
    });
};

module.exports=qacServices;