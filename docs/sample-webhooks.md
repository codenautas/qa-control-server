# Sample WebHooks
Para testear request usamos webhooks reales que genera github.

* Algunos proyectos de codenautas est&aacute;n configurados para enviar sus hooks a testeador.sk.nf
    * Para ver los mismos hay que loguearse en http://testeador.co.nf/codenautas/wh/ y,
        por cada webhook recibido, se visualizar&aacute; un par de archivos con el siguiente formato:
        * `<nombre proyecto>_<fecha>_<event>.txt`: este archivo contiene los headers en formato <name>|<value>
            y el contenido json del webhook en formato c&oacute;modo para ver
        * `<nombre proyecto>_<fecha>_<event>.raw`: este archivo contiene el contenido del request si modificaciones (y, obviamente, sin los headers)
        
* Pasos para generar un webhook para los tests:
    * Seleccionar el para de archivos del hook (.txt y .raw)
    * Elegir un nombre para el para de archivos de test, por ejemplo "mihook"
    * Abrir el .txt y seleccionar los headers, desde la l&iacute;nea siguiente a "----- headers -----" hasta la &uacute;ltima l&iacute;nea,
        no vac&iacute;a, anterior a "------- json ------"
    * Crear un archivo en `<checkout de qa-control-server>\test\webhooks\mihook.headers` y pegar lo copiado en el punto anterior
    * Con el bot&oacute;n derecho del mouse sobre el .raw, elegir "Guardar enlace como..." y salvarlo `<checkout de qa-control-server>\test\webhooks\mihook.raw`
    
    * Finalmente, correr `npm test` para que test-samples.js verifique el mismos

    * Importante:
        * El "secreto" de los webhooks de prueba, con el que hay que configurar github, est&aacute; definido en `test/test-helper.js`
        * En algunos casos pueden existir problemas de fin de l&iacute;nea en los archivos .txt/.raw y esto generar que un sample no valide,
            para intentar corregir el problema, convertir .headers a fin de l&iacute;nea de *nix (\n).
            (a&uacute;n no determin&eacute; si el problema es el navegador y su interacci&oacute;n con el portapapeles y/o el OS al guardar los archivos)
    