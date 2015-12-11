"use strict";

var html = require('js-to-html').html;
html.insecureModeEnabled = true;

var qcsCommon={};

// TODO/WARNING:
//  las referencias a /* hay que actualizarlas a qacServices.rootUrl
qcsCommon.simpleHead = function simpleHead(extraCSS, qacServices) {
    return html.head([
        html.link({href:qacServices.rootUrl+"markdown.css"  ,media:"all", rel:"stylesheet"}),
        html.link({href:qacServices.rootUrl+"markdown2.css" ,media:"all", rel:"stylesheet"}),
        html.link({href:qacServices.rootUrl+"github.css"    ,media:"all", rel:"stylesheet"}),
        html.link({href:qacServices.rootUrl+"qcs.css"       ,media:"all", rel:"stylesheet"}),
        (!!extraCSS?html.link({href:qacServices.rootUrl+extraCSS ,media:"all", rel:"stylesheet"}):null),
        html.link({rel:"shortcut icon", href:qacServices.rootUrl+"favicon.ico"})
    ]);
};

qcsCommon.simpleHtml = function simpleHtml(title, htmlContent, extraCSS, qacServices) {
    var h=html.html([ 
        qcsCommon.simpleHead(extraCSS, qacServices),
        //html.title(title),
        html.body(htmlContent)
    ]);
    return h.toHtmlDoc({pretty:true, title: title||'qa-control'});
};

module.exports=qcsCommon;
