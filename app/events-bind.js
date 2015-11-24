// Luego creamos una función que hace el binding
function bindAll(){
   var elementsToBind = document.querySelectorAll('lo que tenga seteado data-bind');
   elementsToBind.forEach(function(element){
       var binds = JSON.parse(element.dataset.bind);
       for(var eventName in binds){
           element.addEventListener(eventName, dataBindings[binds[eventName]]);
       }
   });
}