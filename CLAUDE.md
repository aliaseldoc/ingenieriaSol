# CLAUDE.md

Proyecto:
-Aplicacion web para gestion de planificacion de visitas tecnicas para grupos electrogenos. La empresa se llama Ingenieria Sol

Rol del agente:
-Desarrollador web con 15 años de experiencia

Acerca de la empresa:
-Somos una empresa electromecanica, principalmente trabajamos con el mantenimiento preventivo de grupos electrogenos. Segun el sevicio usualmente visitamos entre una o dos veces los distintos equipo de forma mensual. Determinados service se realizan una vez al año(baterias,aceite,filtros).

Objetivo:
-Crea una app para gestionar las visitas a cada grupo electrogeno y gestionar un historial del service de cada una. Un cliente puede tener muchos equipos.

Roles en la Aplicacion:
-Administrativos(organizan la hoja de ruta y planificacion para los tecnicos)
-Tecnicos(realizan las visitas a los diferente equipos)
-Supervisores(Validan la visita de cada tecnico)

Funcionalidades de la aplicación:
    El administrativo debe poder:
        -tener un home "Seguimiento" (lo comparte con el supervisor) con:
            -las visitas del mes contra la meta (la cantidad de visitas mensuales de cada equipo), el pronostico a fin de mes y el avance por quincena
            -los equipos en riesgo de no llegar a su meta, con acceso a planificarlos en el calendario
            -los pendientes de cada rol (recibir, datos incompletos; validar, reparaciones, fichajes)
            -las alertas de servicios anuales (con los proximos 90 dias) y de combustible
            -el cierre de los meses anteriores y la comparacion con el mes anterior
        -inventario de equipos agrupados por clientes:
            -con toda su ficha tecnica(luego te voy a especificar todos esos datos generales), historial de visitas, generar las alertar que indiquen que fecha corresponden los sevices anuales
        -calendario de planificacion:
            -poder planificar todas las visitias del mes pudiendo armar la hoja de ruta asignando los tecnicos y el vehiculo para dicha visita
        -recepcion de la visita realizada
    El tecnico debe poder:
        -ver la planificacion mensual asiganada por el administrativo
        -tener un formulario de la visita para completar con los parametros relevantes(luego te dare mas detalles)
        -reportar fallas
    El supervisor:
        -podra dar el ok a la visita del tecnico
        -dar de alta nuevo personal con su formulario de registro y rol
Todos deben tener su usuario y contraseña

Stack de tecnologia:
-html5
-css3(con tailwind)
-JavaScript
-React
-Base de datos y backend: supabase

Preferencias generales:
-todos los textos visibles deben estar en español
-utilizaras las skills necesarias para el desarrollo de la app

Preferencias de diseño:
-Basate en documento html del diseño que tienes en la carpeta desing del proyecto

Preferencias de estilos:
-colores (los del diseño)
-use medidas en rem, usando un font-size base de 10px
-uso de HTML5 y CCS3 nativo
-uso de buenas practicas de maquetacion css y si es necesario usa flexbox y css grid layout
-la web app sea responsive


Preferencias de código:
-No añadas dependencias externas
-html debe ser semantico
-Usa siempre let o const y no uses nunca var
-no uses alerta o ventana modal que aparezca debe tener el mismo estilo que la web
-no uses innerHTML, todo el contenido debe ser insertado con docn appendChild o previamente creando un elemento con document.createElement
-cuidado con olvidar prevenir el default en los eventos submit o click
-prioriza el codigo legible y mantenible
-prioriza que el codigo sea sencillo de entender
-si el agente duda, que revise laas especificaciones del proyecto y si no que pregunte al usuario

Estructura de archivos:
-carpeta (desing)
-CLAUDE.md
-estructuras de ficheros mas adecuada para proyectos de react(lo elige el agente de ia)