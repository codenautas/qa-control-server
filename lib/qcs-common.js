"use strict";

var html = require('js-to-html').html;
html.insecureModeEnabled = true;

var qcsCommon={};

qcsCommon.simpleHtml = function simpleHtml(title, htmlContent, extraCSS) {
    var h=html.html([ html.head([
        html.link({href:"/markdown.css"  ,media:"all", rel:"stylesheet"}),
        html.link({href:"/markdown2.css" ,media:"all", rel:"stylesheet"}),
        html.link({href:"/github.css"    ,media:"all", rel:"stylesheet"}),
        (!!extraCSS?html.link({href:extraCSS ,media:"all", rel:"stylesheet"}):null),
        html.link({rel:"shortcut icon", href:"/favicon.ico"}),
        html.title(title),
        html.body(htmlContent)
    ]) ]);
    return  h.toHtmlDoc({pretty:true});
};

module.exports=qcsCommon;
