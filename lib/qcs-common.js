"use strict";

var qcsCommon={};

qcsCommon.simpleHtml = function simpleHtml(title, content, extraCSS) {
    var r= '<!doctype html>\n<html><head>'+
           '<link href="/markdown.css" media="all" rel="stylesheet" />'+
           '<link href="/markdown2.css" media="all" rel="stylesheet" />'+
           '<link href="/github.css" media="all" rel="stylesheet" />';
    if(!!extraCSS) {
        r += '<link href="' + extraCSS + '" media="all" rel="stylesheet" />';
    }
    r += '<link rel="shortcut icon" href="/favicon.ico">'+
         '<title>'+title+'</title>'+
         '</head><body>'+content+'</body></html>';
    return r;
};

module.exports=qcsCommon;
