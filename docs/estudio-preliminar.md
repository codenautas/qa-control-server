# qa-control-server

## Objetivo

Proveer un servicio web que informe los resultados de **qa-control** y alguna otra información útil.

## Servicios principales

### Obtención de una cucarda de un proyecto. 

Con una url similar a `https://travis-ci.org/codenautas/pg-promise-strict.svg` 
el servicio genera un SVG que se ve así: ![cucarda ejemplo](https://travis-ci.org/codenautas/pg-promise-strict.svg).

El servicio responde a `/organización/proyecto.svg` y muestra el archivo svg que ya fue generado al recibir el push. 

El texto de la cucarda será `qa-control:ok` o `qa-control:1 err` (donde el 1 es la cantidad de errores o warnings). 
El color será verde con `ok` y distintos tonos de amarillo, naranja y rojo cuando haya errores o warnings

### Página de detalles (overview)

Entrando a una url similar a `https://codenautas.com/qa-control/organizacion/proyecto` 
se ven la lista de todos los warnings generados por qa-control (y algunos detalles más)

### Página de resumen de todos los proyectos de una organización

Entrando a una url similar a `https://codenautas.com/qa-control/organizacion` 
se ven la lista de todos los proyectos de la organización, 
al lado de cada nombre de proyecto se ven todas las cucardas que tiene su archivo LEEME.md o README.md

## Funcionamiento

 * cuando **github.com** recibe un push avisa de algún modo al servidor qa-control.
 * el servidor de qa-control-server hace en la carpeta correspondiente al proyecto:
   * git clone (si es la primera vez, si no git pull)
   * `qa-control . > ../result/warnings.json` (con la opción que necesitemos) y registra los resultados
   * generar el archivos cucardas.md
   * generar cucardas.svg (con resultado de la evaluación del scoring de qa-control), el URL para averiguar la cucarda en línea es similar a: `https://img.shields.io/badge/qa--control-1%20err-red.svg` y se va a ver así ![la cuca](https://img.shields.io/badge/qa--control-1%20err-red.svg)
 * cuando recibe una petición (de cucarda, de detalles de un proyecto o de resumen de varios) utiliza la información guardada (no vuelve a ejecutar qa-control)

## Almacenamiento

  * habrá una carpeta `/groups` dentro de esa una carpeta para cada grupo, usuario u organización (ej: codenautas)
  * dentro de la carpeta de una organización habrá una carpeta `/projects` que tendrá una carpeta para cada proyecto o paquete o repositorio github (ej: qa-control)
  * dentro de la carpeta de un proyecto habrá
    * una carpeta `/source` que tendrá el clon del github
    * una carpeta `/result` con los resultados de qa-control
    * una carpeta `/info` con la información obtenida de otras fuentes (ej: el post con el push del github, el histórico de corridas, etc)
    * una carpeta `/params` con los parámetros definidos por el usuario (si los hubiera) respecto del proyecto en particular
 
## URL

path                          | p/p | uso
------------------------------|-----|----------------------------------------
`/organización`               | pub | el resumen de proyectos de la organización
`/organización/proyecto`      | pub | los detalles del proyecto
`/organización/proyecto.svg`  | pub | la cucarda
`/`                           | pub | propaganda
`/login`                      |loging| se encarga el paquete `login-plus`
`/admin`                      | priv| configuración del usuario y pantalla para agregar proyectos (para quitar se usa  `/organización` que cuando estás logueado te agrega un botón "eliminar"

