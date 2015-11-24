dataBindings={
   actionDeleteProject: function(event){
       ajaxBestPromise.post({
          url:'/delete/'+this.dataset.organization+'/'+this.dataset.project
       }).then(function(r){
           // 
       });
   },
   shide: function(event){
      //
   },
   actionNewProyect:function(event){
   }
}

