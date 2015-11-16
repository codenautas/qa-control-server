"use strict";

var qcsCommon={};

qcsCommon.simpleHtml = function simpleHtml(title, content) {
    return '<!doctype html>\n<html><head>'+
           '<link href="/markdown.css" media="all" rel="stylesheet" />'+
           '<link href="/markdown2.css" media="all" rel="stylesheet" />'+
           '<link href="/github.css" media="all" rel="stylesheet" />'+
           '<link rel="shortcut icon" href="/favicon.ico">'+
           '<title>'+title+'</title>'+
           '</head><body>'+content+'</body></html>';
};

module.exports=qcsCommon;
