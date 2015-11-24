"use strict";
/*jshint eqnull:true */
/*jshint globalstrict:true */
/*jshint browser:true */

var AjaxBestPromise = {};

/* global Promise */

AjaxBestPromise.createMethodFunction=function(method){
    return function(params){
        var promiseForReturn = function(chunkConsumer){
            return new Promise(function(resolve,reject){
                var ajax = new XMLHttpRequest();
                var receivePart;
                if(chunkConsumer){
                    var initialPos=0;
                    var endPos=0;
                    receivePart=function(isLastPart){
                        if(endPos<ajax.responseText.length){
                            initialPos=endPos;
                            endPos=ajax.responseText.length;
                            chunkConsumer(ajax.responseText.substr(initialPos,endPos),isLastPart);
                        }else if(isLastPart){
                            chunkConsumer('',isLastPart);
                        }
                    };
                    // var interval = setInterval(receivePart,1000);
                    ajax.multipart=true;
                    ajax.onprogress=function(pe){
                        /* istanbul ignore next */ 
                        if (ajax.readyState != 2 && ajax.readyState != 3 && ajax.readyState != 4){
                            return;
                        }
                        /* istanbul ignore next */ 
                        if (ajax.status != 200){
                            return;
                        }
                        receivePart();
                    };
                }else{
                    receivePart=function(){};
                }
                ajax.onload=function(e){
                    // clearInterval(interval);
                    if(ajax.status!=200){
                        reject(new Error(ajax.status+' '+ajax.responseText));
                    }else{
                        receivePart(true);
                        resolve(ajax.responseText);
                    }
                };
                ajax.onerror=function(err){
                    /* istanbul ignore next */ 
                    if(!(err instanceof Error)){
                        err=new Error('Error boxed '+err+' '+JSON.stringify(err)+' / '+ajax);
                    }
                    reject(err) ;
                };
                var paqueteAEnviar=Object.keys(params.data).map(function(key){
                    return key+'='+encodeURIComponent(params.data[key]);
                }).join('&');
                var url=params.url+((paqueteAEnviar && method!=='POST')?'?'+paqueteAEnviar:'');
                ajax.open(method,url,true);
                ajax.setRequestHeader('X-Requested-With','XMLHttpRequest');
                if(method==='POST'){
                    ajax.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
                    ajax.send(paqueteAEnviar);
                }else{
                    ajax.send();
                }
            });
        };
        var intermediateObject={
            onJson: function(jsonConsumer){
                return intermediateObject.onLine(function(line){
                    jsonConsumer(JSON.parse(line));
                });
            },
            onLine: function(lineConsumer){
                var remain="";
                return promiseForReturn(function chunkConsumer(chunk,isLastPart){
                    remain+=chunk;
                    var slices=remain.split(/(\r\n|\r(?!\n)|\n)/);
                    while(slices.length>(isLastPart?0:1)){
                        lineConsumer(slices.shift()+(slices.length?slices.shift():''),!slices.length);
                    }
                    remain=slices.shift();
                });
            },
            onChunk:function(chunkConsumer){
                return promiseForReturn(chunkConsumer);
            },
            then:function(resolve,reject){
                return promiseForReturn().then(resolve,reject);
            },
            'catch':function(reject){
                return promiseForReturn().catch(reject);
            }
        };
        return intermediateObject;
    };
};

AjaxBestPromise.post=AjaxBestPromise.createMethodFunction('POST');
AjaxBestPromise.get=AjaxBestPromise.createMethodFunction('GET');

AjaxBestPromise.fromElements=function fromElements(listOfElementsOrIds,addParam,base){
    var actual=base;
    if(typeof actual==="undefined"){
        actual={};
    }
    addParam=addParam||function(actual,name,value){
        actual[name]=value;
        return actual;
    };
    listOfElementsOrIds.forEach(function(elementOrId){
        var element;
        if(typeof elementOrId == 'string'){
            element=document.getElementById(elementOrId);
        }else{
            element=elementOrId;
        }
        if(!element || !(element instanceof Element)){
            throw new Error('AjaxBestPromise.fromElements must receive a list of elements');
        }
        var value;
        if('value' in element){
            value=element.value;
        }else{
            value=element.textContent;
        }
        actual=addParam(actual,element.id,value);
    });
    return actual;
};

AjaxBestPromise.completePath=function completePath(listOfElementsOrIds){
    return AjaxBestPromise.fromElements(listOfElementsOrIds,function(actual,name,value){
        return (!actual?'':actual+'/')+encodeURI(value);
    },'');
};
