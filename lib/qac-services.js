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

function md5(text){
    return 'md5.'+crypto.createHash('md5').update(text).digest('hex');
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
                resolve(qcsCommon.simpleHtml('QA Control Server',
                                             '<article class="markdown-body entry-content" itemprop="mainContentOfPage">'+ok+'</article>'));
            }
        });
    });
};

app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));

qacServices = {
    development: false,
    loginPlusInitialized : false,
    repository: {
        path : './repositories',
        request_secret: 'HK39Sas_D--lld#h./@'
    }
};

qacServices.config = function(opts, production){
    //console.log("qacServices.config <- opts", opts, production);
    if(opts) {
        if(opts.repository) {
            qacServices.repository = opts.repository;
        }
    }
    qacServices.development = !production;
};

function initLoginPlus() {
    if(! qacServices.loginPlusInitialized && ! qacServices.development) {
        qacServices.loginPlusInitialized = true;
        loginPlus.init(app,
                {successRedirect:'/admin'
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
                    if(!!user && ! user.locked && user.pass == md5(password+username)) {
                        done(null, {username: username, when: Date()});
                    } else {
                        done('Unauthorized');
                    }
                }).catch(function(err){
                    console.log('error logueando',err);
                    console.log('stack',err.stack);
                }).catch(done);
            }
        );    
    }
};


function json2file(filePath, jsonData) {
    return fs.writeFile(filePath, JSON.stringify(jsonData, null, 4), {encoding:'utf8'});
}

function Bitacora(pathInfo, pathBita) {
    this.pathInfo = pathInfo;
    this.pathBita = pathBita;
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
        //console.log("------------ todo -----------", logs);
        var pathInfo = this.pathInfo;
        var fileBita = logs.filter(isBitacora);
        var vNow = this.now();
        json2file(this.pathBita+'bitacora.json', fileBita).then(function() {
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

// parameters:
//        organization: name of organization
//        opts.project: name of project
//  opts.createProject: create project if not exists
//                      and is listed on organization/params/projects.json
qacServices.getInfo = function getInfo(organization, opts){
    var info={};
    opts = opts || {};
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
                throw new Error('inexistent organization "'+organization+'"');
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
            if(opts.project) {
                var projectFound=projects.filter(function(element, index, array) {
                    return element.projectName==opts.project;
                });
                if(!projectFound) {
                    throw new Error('inexistent project "'+opts.project+'"');
                }
                info.project = {
                    path:Path.normalize(info.organization.path+'/projects/'+opts.project),
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
            }
        }).then(function() {
            return info;
        });
    });
};

var reOrg = /^([a-zA-Z][a-zA-Z0-9_-]+)$/i;

qacServices.createOrganization = function createOrganization(name) {
    var orgPath = Path.normalize(qacServices.repository.path+'/groups/'+name);
    var dirs = [orgPath, 
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
        return Promises.all(dirs.map(function(dir) {
            return fs.mkdir(dir);
        })).then(function() {
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
    var opts = project ? { project : project } : null;
    return qacServices.getInfo(organization, opts).then(function(info) {
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
    return app.post('/push/:organization/:project',function receivePushService(req,res){
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
        var info;
        var clonePath, resultsPath;
        var bitacora = null;
        var cucardasFile;
        var qaControlWarnings;
        qacServices.getInfo(repo.organization, {project:repo.name, createProject:true}).then(function(nfo) {
            info = nfo;
            clonePath = Path.normalize(info.project.path+'/source');
            resultsPath = Path.normalize(info.project.path+'/result');
            cucardasFile = Path.normalize(clonePath+'/cucardas.log');
            bitacora = new Bitacora(Path.normalize(info.project.path+'/info/'), Path.normalize(resultsPath+'/'));
            //bitacora.logAll('internal: payload', req.body);
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
            bitacora.logAll('shell: git', result);
            bitacora.log('shell: git', result.stdout ? result.stdout : result.stderr);
            if(result.exit != 0) {
                bitacora.fail(new Error("git failed with code"));
            }
            return qaControl.controlProject(clonePath, {verbose:false, cucardas:true});
        }).then(function(warns) {
            qaControlWarnings = warns;
            //console.log("warns", warns);
            bitacora.logAll('internal: qa-control',warns);
            bitacora.log('internal', 'qa-control-result: '+JSON.stringify(warns));
            return json2file(Path.normalize(resultsPath+'/qa-control-result.json'), warns);
        }).then(function() {
            return fs.stat(cucardasFile);
        }).then(function() {
            return true;
        }).catch(function(err) {
            if(err.code !== 'ENOENT') { bitacora.fail(err); }
            return false;
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
            res.write('ok: '+req.body.head_commit.timestamp)
            res.end();
            //console.log("bitacora", bitacora);
        }).catch(function(err) {
            console.log("err", err);
            bitacora.logAll('internal: exception', err);
            bitacora.finish();
            res.status(500);
            res.end("fatal error");
        });
    });
};

qacServices.getOrganizations = function getOrganizations(){
    var organizations=[];
    var repoPath = Path.normalize(qacServices.repository.path+'/groups');
    return Promises.start(function() {
        return fs.readdir(repoPath).catch(function(err) {
            if(err.code==='ENOENT') {
                throw new Error('inexistent repository "'+repoPath+'"');
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

function makeButton(title, link, method, confirmMsg, okJS) {
    var sendLink = "this.form.method='"+method+"'; this.form.action='"+link+"';";
    if(okJS) { sendLink += ' '+okJS; }
    sendLink += " this.form.submit();";
    var oclick = !!confirmMsg ? "if(confirm('"+confirmMsg+"?')) { "+sendLink+" }" : sendLink; 
    return '<input type="button" value="'+title+'" onClick="'+oclick+'" />';
};

qacServices.makeOverviewMd = function makeOverviewMd(organization, project){
    var opts = project ? { project : project } : null;
    return qacServices.getInfo(organization, opts).then(function(info) {
        var method = qacServices.development ? 'get' : 'post';
        var header = 'Project|Cucardas|Actions\n---|---|:---:\n';
        var accPref = '';
        if(qacServices.development) { accPref = 'manual-'; }
        if(!!project) {
            console.log("Solo proyecto", project);
            return fs.readFile(Path.normalize(info.organization.path+'/projects/'+project+'/result/cucardas.md'), 'utf8').catch(function(err) {
                if(err.code !== 'ENOENT') { throw err; }
                return qacServices.invalidSVG();
            }).then(function(content){
                var r = project+'|'+content.split('\n').join(' ');
                //console.log("content", content);
                r += '|' + makeButton('qa-control', '/'+organization+'/'+project+'.svg', 'get');
                if(qacServices.user || qacServices.development) {
                    r += makeButton('Delete', '/'+accPref+'delete/'+organization+'/'+project, method, 'Delete project \\\''+project+'\\\'')
                }
                return header+r+'\n';
            });
        } else {
            var buttonNewProject = '';
            if(qacServices.user || qacServices.development) {
                var oclick = 'var p=this.form.project; var org=this.form.organization.value;'
                            +' if(p.value != \'\') { this.form.action=\'/'+accPref+'create/\'+org+\'/\'+p.value;'
                            +' this.form.method = \''+method+'\'; this.form.submit(); }'
                            +' else { p.focus(); }';
                buttonNewProject='\n\n|New project\n|:---:\n|<input type="hidden" name="organization" value="'
                                     +organization
                                     +'" /><input type="text" name="project" />&nbsp;&nbsp;<input type="button" value="Create..." onClick="'
                                     +oclick+'" />\n';
            }
            if(info.organization.projects.length) {
                return Promises.all(info.organization.projects.map(function(project) {
                    return fs.readFile(Path.normalize(info.organization.path+'/projects/'+project.projectName+'/result/cucardas.md'), 'utf8').catch(function(err) {
                        if(err.code !== 'ENOENT') { throw err; }
                        return qacServices.invalidSVG();
                    }).then(function(content){
                        var r = project.projectName+'|'+content.split('\n').join(' ');
                        r += '|' + makeButton('Browse', '/'+organization+'/'+project.projectName, 'get');
                        if(qacServices.user || qacServices.development) {
                            r += makeButton('Delete', '/'+accPref+'delete/'+organization+'/'+project.projectName, method, 'Delete project \\\''+project.projectName+'\\\'')
                        }
                        return r;
                    });
                })).then(function(contents){
                    var ret = header+contents.join('\n')+buttonNewProject;
                    //fs.writeFileSync("_pppp_.log", ret, 'utf8');
                    return ret;
                });                
            } else {
                return buttonNewProject;
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
    return qacServices.getInfo(organization, {project:project}).then(function(info) {
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
    return app.get('/:organization/:project?',function(req,res,next){
        if(req.params.organization.match(/(.(css|jpg|png|gif|ico))$/)) {
            return res.sendFile(Path.resolve('./app/'+req.params.organization));
        } else if(req.params.organization.match(/^(login|admin|(manual-)?(delete|create))$/)) {
            return next();
        } else {
            var action = (!!req.params.project && req.params.project.match(/(.svg)$/)) ?
                            thisModule.serveSVG :
                            thisModule.makeOverviewHtml;
            action(req.params.organization, req.params.project).then(function(content){
                res.end(content);                
            }).catch(function(err) {
                console.log("overviewServe err", err);
            }); 
        }
    });
};

qacServices.adminServe = function adminServe() {
    initLoginPlus();
    var thisModule = this;
    return app.get('/admin', function(req,res,next){
        var method = 'post';
        var accPref = '';
        if(!qacServices.development) {
            thisModule.user = req.session.passport.user;
        } else {
            method = 'get';
            accPref = 'manual-';
        }
        //var okJS = ' document.removeChild(document.getElementById(\'org\'));'
        var okJS = null;//' this.form.removeChild(document.getElementById(\'org\'));'
        qacServices.getOrganizations().then(function(orgs) {
            var out='<em><form></em>\n\n';
            out += 'Organizations|Actions\n---|:---:\n';
            for(var o=0; o<orgs.length; ++o) {
                var org = orgs[o];
                out += org
                       + '|' + makeButton('Browse', '/'+org, 'get')+' '
                       +makeButton('Delete', '/'+accPref+'delete/'+org, method, 'Delete organization \\\''+org+'\\\'', okJS)+'\n';
            }
            var oclick = 'var o=this.form.organization;'
                        +' if(o.value != \'\') { this.form.action=\'/'+accPref+'create/\'+o.value;'
                        +' this.form.method = \''+method+'\'; this.form.submit(); }'
                        +' else { o.focus(); }';
            out += '\n|New organization\n|:---:\n|<input type="text" name="organization" />&nbsp;&nbsp;<input type="button" value="Create..." onClick="'+oclick+'" />\n';
            out += '\n<em></form></em>';
            return markdownRender(out);
        }).then(function(content) {
            res.end(content);
        });
        //
    });
};

function handleAbms(thisModule) {
    this.handle = function(req, res, next) {
        var actionPref = '';
        if(! qacServices.development) {
            thisModule.user = req.session.passport.user;
        } else {
            actionPref = 'manual-';
        }
        var doAction=null;
        switch(req.params.action) {
            case actionPref+'delete': doAction = thisModule.deleteData; break;
            case actionPref+'create':
                doAction = req.params.project ?
                    thisModule.createProject :
                    thisModule.createOrganization; // ignora req.params.project
                break;
        }
        if(! doAction) { return next(); }
        doAction(req.params.organization, req.params.project).then(function(content) {
            res.end(content); 
        }).catch(function(err) {
            res.end(err.message);
        });
    };
};

qacServices.abmsServe = function abmsServe() {
    initLoginPlus();
    var urlParams = '/:action/:organization/:project?';
    var handler = new handleAbms(this);
    return qacServices.development ? app.get(urlParams, handler.handle) : app.post(urlParams, handler.handle);
};

module.exports=qacServices;