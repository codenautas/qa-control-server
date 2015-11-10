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
            console.log("users", users);
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
    
qacAdminServices.adminServe = function adminServe() {
    return app.get('/admin', function(req,res,next){
        res.end('admin');
    });
};

module.exports=qacAdminServices;