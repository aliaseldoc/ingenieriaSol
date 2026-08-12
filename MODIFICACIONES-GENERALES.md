# MODIFICACIONES.md

	<!-- (CORREGIDA)-agregar cant de aceite a la ficha tecnica del equipo (Justo despues de cant de combustible)
	(CORREGIDA)-El supervisor puede eliminar clientes
	(CORREGIDA)-Agregar campo "Descripción" en el formulario "Nueva hoja de ruta" y que ese sea el texto que se visualice en el calendario(esto quedo bien pero mueve el input arriba, justo debajo del titulo y agranda el font size general de ese formulario)
	(CORREGIDA)- y si tipo de visita = mantenimiento preventivo agregar select con "Primera visita" y "Segunda visita"
	(CORREGIDA)-Los campos del formulario de la visita  tecnica deben ser obligatorios menos la firma que puede ser opcional
	(CORREGIDA)-Ver vista "Resumen" en rol supervisor(Igual que el adimin)
	(CORREGIDA)-En el listado de visitas realizadas quiero ver tmb las que esten pendientes de aprobacion
	(CORREGIDA)-bug rol administrativo => Recepcion => todas = 0 resultado esperado tengo una visitia
	(CORREGIDA)-En el  historial de la visita cambiar leyenda de "Esperando revision" a "Enviada"
	(CORREGIDA)-Agranda el font size el formulario de la visita

	-En la hoja de edicion detalle de equipo debajo de "Seguimieto" agregar "Proximo Service" con los campos:
		(CORREGIDA)-Cambio Filtro de combustible(default se auto complete un año despues de la fecha que indique seguimiento pero sea editable)
		(CORREGIDA)-Cambio Filtro de aceite(default se auto complete un año despues de la fecha que indique seguimiento pero sea editable)
		(CORREGIDA)-Cambio bateria(default se auto complete dos años despues de la fecha que indique seguimiento pero sea editable)
	-y agreguegar tanto en seguimiento como proximo service:
		(CORREGIDA)-Cambio filtro de aire (default se auto complete un año despues de la fecha que indique seguimiento pero sea editable)
		
		(CORREGIDA)-Nivel de combustible en la ficha tecnica debe tener doble input "Cant de Litros" y el actual de porcentaje(Si la ficha tecnica conoce el tamaño de tanque al ingresar la cantidad de litros auto complete el segundo input del porcentaje).
		Modificaciones del item anterior
		(CORREGIDA)-El Doble input va en el formulario de la visita tecnica. El tecnico puede introducir "Cantidad de combustible" o "Porcentaje"(Como esta actualmente) En la ficha tecnica debe tener el campo "Tamaño del tanque" que indique numerica cuantos litros contiene y Porcentaje de Combustible. Si el tecnico en el formulario completa la cantidad de litros que tiene el tanque quiero que se auto complete su nivel de porcentaje siempre que se conozca el tamaño del tanque


		(CORREGIDA)-Los botones de guardar borrador o finalizar reporte moverlos al final del formulario
		(CORREGIDA)-Agregar un option al select del funcionamieto del precalentador "No tiene" Y si el estado es distinto de OK el valor de medicion ya no es obligatorio
		
		(CORREGIDA)-Hay un pequeño bug al iniciar sesión debo presionar dos veces el boton de iniciar(Sigue haciendo el mismo bug)
		
		(CORREGIDA)-El supervisor puede editar o eliminar una visita sin reporte del tecnico
		(CORREGIDA)-Agregar un boton "Eliminar" en el detalle de equipo (invetario-equipo-editar)  -->

		Realiza esta nueva ronda de modificaiones:

			(CORREGIDA)-Incluir en la pantalla de panel de control alertas de combustible cuando esté este al 30% o menos.
			(CORREGIDA)-En la vista mensual o semanal quita relevancia a los sábados y domingo ya que esos días no se programas visitas pero no los elimines del caledario solo hazlos mas pequeños y reparte ese espacio en los días hábiles
			(CORREGIDA)-Agregar una funcion para replicar una planificacion para el mes siguiente. Asegurando que siempre se asignen visitas a los dias habiles.
			(CORREGIDA)-Ajusta los estilos del cuadro de referencia de colores del calendario, agranda un poco el tamaño del circle de referencia.
			(CORREGIDA)-Agrega en el asaide debajo de "Equipos" un vista de "Clientes" que contenga:
				-Listado de clientes con su ficha de datos
				-Equipos(que al hacer click abra el mismo detalle que usa "Equipos")
			(CORREGIDA)-En el listado de mi plan mensual que se agrupen por hospitales(puede ser una vista similar a la que tambien utiliza "Equipos)

			Correcciones:
				(CORREGIDA)1-En la funcion replicar planificación que aplique la siguiente logica, sin alterar el orden se orgnicen desde el primer dia habil en adelante salteando sabados y domingos
				(CORREGIDA)2-El listado de plan mensual se agrupe por hospital pero se ordene por fecha desde la mas proxima

		(CORREGIDA)Una funcion mas.
			El titular "Hojas de Ruta sin Asignar" quiero sin modificar ese listado tambien sea un boton que me lleve a una nueva vista, puede seguir siendo en formato de pop up para que el usuario tenga la opcion de seleccionar muchas visitas y asignarles tecnicos y vehiculos

		(CORREGIDA)correccion
			-agrega un over a hojas de ruta sin asignar
			- correccion estetica:
				-las lista de tecnicos solo muestre hasta 5 y luego tenga scroll
				-vehiculos siga siedo menu desplegable
				-hoja de rutas ocupe el resto del espacio disponible

(CORREGIDA)-el texto temperatura del agua reemplazalo por temperatura del motor
(CORREGIDA)-Los imputs Cant de combustible y nivel de combustible unificalos y que se pueda elegir la unidad "Lts" o "%"
(CORREGIDA)-el boton guardar borrador quiero que sea un boton flotante que el usuario pueda mover por cualquier parte de la pantalla pero que siempre este presente
	*esta bien pero por default que se cargue hacie el lado izquierdo
(Todavia no lo verifique)-Si el imput de la ficha tecnica de cant de baterias es 1 es decir el equipo es de 12v. Si tiene 2 entonces funciona a 24v. Utilizar esta informacion para el rango de parametros normales de la visita tecnica al indicar tanto el cargador de flote como la tension de alternador de carga de baterias
(CORREGIDA)-Debajo de la seccion operaciones equipo en marcha agrega un nuevo recuadro que tenga otro form con la siguiente informacion:
	-agregado de aceite (input cant) unidad "Litros"
	-agregado de liquido refrigerante (input cant) unidad "Litros"
	-cambio filtro de combustible (select "No" "Si") default No
	-cambio filtro deaceite (select "No" "Si")default No
	-cambio filtro de aire (select "No" "Si")default No
	-cambio bateria (select "No" "Si")default No
Mismo comportamiento de la informacion recibida. Al administrativo dar por recibida la ficha del tecnico actualizar la informacion de la ficha completando el dato de la fecha de los cambios correspondientes y ajustando los proximos service con los vencimientos ya indicados
	*No no lo probe pero agreguega tambien el campo Agregado de combustible(Este dato solo sale en el informe pero no modifica el porcentaje)
(CORREGIDA)-Eliminar el boton de eliminar cliente de la vista de equipos
(CORREGIDA)-En la vista Clientes al hacer click en el div del detalle del cliente que abra un pop up "Detalle del Cliente" que va a conterner la misma informacion que tenemos actualmente (Quizas luego se guarde mas detalle de los mismo) e incuir aqui dos botones para modificar o borrar (Solo disponible admin)
(CORREGIDA)-Ademas de la correccion puntual del input en version mobile verifica todo los ajustes vizuales en tablet y mobile de toda la app en todos sus roles, La vista del panel de control en tablet se rompe vizualmente, los textos del nombre del cliente en actividad reciente se corta teniendo 3/4 de espacio disponible, los inconos para navegar en distintas vistas elimina los textos y tambien ajusta la visual , el contenido de las burbujas tambien desborda, agranda el avatar de la sesion	
	*Elimina los textos de los botones de navegacion en la version mobile, solamante se renderice los iconos
(CORREGIDA)-El administrador puede solicitar eliminar Cliente o Equipo con aprobación del supervisor y este lo vea en Pendientes dentro de "Validacion"
(CORREGIDA)-En la vista Detalle de Visita "Detalle de equipo " se renderice arriba de "Validacion tecnica"(Actualmente estan de lado)
	*Corrige la vista del apartado "Cambio y Agregados" los campos se ven desfasados en cada renglon ajusta a un formato tabla mejor visible
(Todavia no lo verifique)-Este item Si el técnico elige "Lts" sin que el equipo tenga `fuel_capacity` cargado, mostrar un texto de ayuda ("Cargá el Tamaño de Tanque en la ficha técnica para calcular el %") sin bloquear el envío. Que esa accion no frene el envio del formulario. pero si que marque la leyenda que falta completar el tamaño del tanque