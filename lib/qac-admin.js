"use strict";

var qacAdminServices={};

var app = require('express')();
var crypto = require('crypto');
var Promises = require('best-promise');
var fs = require('fs-promise');
var Path = require('path');
var OS = require('os');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var execToHtml = require('exec-to-html');
var request = require('request-promise');
var loginPlus = require('login-plus');
var crypto = require('crypto');

function md5(text){
    return 'md5.'+crypto.createHash('md5').update(text).digest('hex');
}

app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));

qacAdminServices.config = function(services, opts) {
    qacAdminServices.services = services;
};

loginPlus.init(app,{ });
loginPlus.setValidator(
    function(username, password, done) {
        var users;
        fs.readJson('./app/users.json').then(function(json) {
            users = json;
            console.log("users", users);
        }).then(function() {
            
            done(null, {});
        })/*;
        // console.log('intento de entrar de ',username,password);
        clientDb.query(
            'SELECT usuario as username FROM reqper.usuarios WHERE usuario=$1 AND clavemd5=$2',
            [username, md5(password+username.toLowerCase())]
        ).fetchUniqueRow().then(function(data){
            console.log('datos traidos',data.row);
            done(null, data.row);
        }).catch(function(err){
            console.log('err',err);
            if(err.code==='54011!'){
                done('Error en usuario o clave');
            }else{
                throw err;
            }
        })*/.catch(function(err){
            console.log('error logueando',err);
            console.log('stack',err.stack);
        }).catch(done);
    }
);
    
qacAdminServices.adminServe = function adminServe() {
    return app.get('/admin', function(req,res,next){
        res.end('admin');
    });
};

console.log("emilio", md5('jardilinemilio'));
console.log("diegoefe", md5('deflow2269diegoefe'));

module.exports=qacAdminServices;