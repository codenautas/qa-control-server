"use strict";

var html = require('js-to-html').html;
html.insecureModeEnabled = true;

var qcsCommon={};

// TODO/WARNING:
//  las referencias a /* hay que actualizarlas a qacServices.rootUrl
qcsCommon.simpleHead = function simpleHead(extraCSS) {
    return html.head([
            html.link({href:"/markdown.css"  ,media:"all", rel:"stylesheet"}),
            html.link({href:"/markdown2.css" ,media:"all", rel:"stylesheet"}),
            html.link({href:"/github.css"    ,media:"all", rel:"stylesheet"}),
            html.link({href:"/qcs.css"    ,media:"all", rel:"stylesheet"}),
            (!!extraCSS?html.link({href:extraCSS ,media:"all", rel:"stylesheet"}):null),
            html.link({rel:"shortcut icon", href:"/favicon.ico"})
        ]);
};

qcsCommon.simpleHtml = function simpleHtml(title, htmlContent, extraCSS) {
    var h=html.html([ 
        qcsCommon.simpleHead(extraCSS),
        //html.title(title),
        html.body(htmlContent)
    ]);
    return h.toHtmlDoc({pretty:true, title: title||'qa-control'});
};

module.exports=qcsCommon;
