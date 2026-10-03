# FICHAJE.md

Módulo de fichaje de empleados (control horario mixto: reloj biométrico + app).
Complementa a CLAUDE.md: todas sus reglas de estilo, código y stack siguen vigentes.

---

## Objetivo

- Registrar la entrada y la salida de todo el personal de Ingeniería Sol.
- Sistema **mixto**:
    - **Reloj biométrico (huella)** instalado en la fábrica.
    - **Fichaje desde la app** (celular) para los técnicos que empiezan o terminan la jornada en la calle.
- El supervisor corrige lo que haga falta y cierra la semana.
- Resultado final: **reporte semanal** por empleado con horas normales, horas extras al 50% y horas extras al 100%.

## Situaciones reales que el sistema debe resolver

1. El técnico ficha la entrada con huella en la fábrica y la salida desde la app en la calle, sin volver a la fábrica.
2. El técnico empieza en la calle (entrada por app) y termina en la fábrica (salida con huella).
3. El técnico empieza y termina en la calle (entrada y salida por app).
4. Los empleados de fábrica solo usan el reloj biométrico.
5. Alguien se olvida de fichar: el supervisor lo corrige a mano.

---

## Roles

| Rol | Qué hace en este módulo |
|---|---|
| **Supervisor** | Único responsable del módulo. Da de alta empleados de fábrica, importa el archivo del reloj, corrige fichajes, marca los feriados, ve el reporte, lo exporta y cierra o reabre semanas. |
| **Técnico** | Ficha entrada y salida desde la app (con ubicación). Ve sus propios fichajes y sus horas calculadas, **solo lectura**. |
| **Administrativo** | **No participa.** No ve ni modifica nada del fichaje (organiza visitas, nada más). |
| **Empleado de fábrica** | **No tiene usuario en la app.** Existe solo como legajo para el reloj y el reporte. |

> Excepción aprobada a CLAUDE.md ("todos deben tener su usuario y contraseña"): los empleados de fábrica son legajos sin usuario.

**Alcance del reporte:** todo el personal que fiche. Incluye técnicos, empleados de fábrica y también administrativos y supervisores si fichan en el reloj. Concretamente entran:
- los legajos activos con N° en el reloj;
- los técnicos (fichan por la app);
- cualquiera que tenga fichajes en la semana.

Así, quien no ficha no aparece con el feriado pago como única hora.

---

## Lector biométrico

### Equipo elegido
El cliente confirmó **un reloj con WiFi integrado**, para no depender de que alguien pase el pendrive todas las semanas.
Modelo elegido: **ZKTeco F22** (3.000 huellas, 30.000 eventos, pantalla táctil de 2,4", WiFi de fábrica más TCP/IP y RS485 por si el WiFi no llega a la puerta).
Su ficha declara compatibilidad con *BioTime PRO (requiere ADMS)*: **ADMS es el protocolo de esta integración**, así que el equipo sirve.
La variante **MF** (tarjetas Mifare) y la **ID** (tarjetas EM) son la misma máquina con distinto lector de tarjetas: para el fichaje por huella da igual.

Dos detalles prácticos del F22:
- **La fuente de 12V 3A no viene incluida.** Hay que comprarla aparte.
- **No trae batería de respaldo.** Sin luz no ficha; los fichajes de ese rato se corrigen a mano (el técnico igual puede fichar por la app). Si la fábrica tiene UPS, conviene colgarlo de ahí.

Requisitos, por si hay que cambiar de modelo:
- **Protocolo push / ADMS** con **dirección y puerto editables** (en el menú aparece como "Servidor en la nube" o "ADMS"). Es el requisito crítico: que el equipo tenga WiFi no alcanza. Los modelos chicos tipo **ZKTeco M1 funcionan solo contra BioTime Cloud**, la nube de la marca, y no se pueden apuntar a nuestro servidor: no sirven para este proyecto.
- **Exportación de registros a pendrive USB** (TXT/DAT/CSV), que es el respaldo cuando el equipo se queda sin red.
- Capacidad de huellas y registros holgada, batería de respaldo y reloj interno.
- ⚠️ **Preguntar por la versión de firmware y si el ADMS soporta HTTPS** antes de comprar (ver "Si el reloj no habla HTTPS").

### Integración de respaldo: importación de archivo
- El supervisor descarga el archivo del reloj (USB) y lo sube en la app.
- Sin hardware ni programas extra, sin dependencias nuevas.
- Los fichajes del reloj aparecen en la app **cuando se importan** (no en tiempo real).
- Se arranca **ya** con dos formatos:
    1. **CSV genérico**, con fila de encabezado `legajo,fecha,hora`:
        - separador `,` o `;`;
        - fecha `AAAA-MM-DD` o `DD/MM/AAAA`;
        - hora `HH:MM` o `HH:MM:SS`.
    2. **Archivo típico de ZKTeco** (`attlog`, texto separado por tabulaciones):
        - columna 1: N° de usuario en el reloj;
        - columna 2: `AAAA-MM-DD HH:MM:SS`;
        - el resto de las columnas se ignora.
- ⚠️ El formato ZKTeco se **valida y ajusta con un archivo real** cuando llegue el equipo. El parser debe quedar aislado en un solo archivo para que ese ajuste sea trivial.

---

## Integración directa con el reloj (WiFi)

El reloj manda cada fichaje **apenas ocurre**, sin que nadie pase el pendrive. Usa el protocolo **push (ADMS)** de ZKTeco: el equipo sale a buscar al servidor por su cuenta, así que **no hace falta IP fija en la fábrica ni abrir puertos** en su router.

### Cómo se conecta
- En el reloj: **Menú → Comunicación → Servidor en la nube (ADMS)**. Dirección `ingenieria-sol.vercel.app`, puerto `443`, conexión segura activada.
- Se carga **solo el dominio**: el equipo arma `/iclock/...` por su cuenta. Por eso el endpoint no puede vivir en una subruta, y las Edge Functions de Supabase (`/functions/v1/...`) no sirven para esto.
- Lo atiende `api/iclock.js` (función del deploy de Vercel del mismo repo), con la traducción del protocolo aislada en `api/_reloj/protocolo.js`. Sin dependencias nuevas.
- Variables de entorno en Vercel: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Sin prefijo `VITE_`, así no terminan en el paquete del navegador.
- El endpoint no decide nada del negocio: llama a `ingest_clock_punches`, que valida, guarda y cuenta en una sola transacción.

### Lo que habla el equipo (verificado con un F22/ID real)

Puesto en marcha el 3/10/2026 contra el equipo `CQZ7232760113` (`FirmVer 8.0.4.3-20220708`, `PushVersion 2.0.33S`, `DeviceType=acc`). Dos cosas no coincidían con el protocolo genérico y hay que tenerlas presentes al sumar otro reloj:

- **El alta es obligatoria y va antes que todo.** El equipo saluda y acto seguido hace `POST /iclock/registry` con su ficha técnica completa. Espera que el servidor le conteste `RegistryCode=<algo>`. Si recibe cualquier otra cosa (un `OK`, por ejemplo) **se queda sin registrar, repite el ciclo cada 15 s y no manda un solo fichaje**. En la pantalla se ve como un ✗ rojo sobre el ícono del servidor.
- **Los equipos de control de acceso no mandan `ATTLOG`, mandan `RTLOG`**, con otro formato: pares `clave=valor` separados por tabulaciones, un evento por línea, apenas ocurre.

```
time=2026-10-03 14:10:32	pin=9999	cardno=0	event=3	verifytype=1	index=10	...
```

En el mismo flujo vienen mezcladas líneas de estado de la puerta (`time=…	sensor=01	relay=00	door=01`), que no tienen `pin`.

**Qué cuenta como fichaje:** toda línea con hora válida y un `pin` distinto de 0. No se filtra por el código de `event` a propósito. En las pruebas el único código de verificación correcta fue el `3` (con huella, clave y tarjeta), y las tarjetas no reconocidas llegaron como `event=27` con `pin=0`. Pero la tabla de códigos de ZKTeco cambia entre modelos y firmwares, y descartar por un código desconocido perdería fichajes reales; en cambio, todo lo que no identifica a una persona ya viene con `pin=0` o sin `pin`, así que queda afuera solo.

Las tablas `options`, `rtstate`, `tabledata`, `operlog`, `attphoto` y `biodata` son sincronización del equipo (su configuración, su lista de usuarios, el estado de la puerta): se contestan OK y no se anotan, porque llegan todo el tiempo. Una tabla que no esté en esa lista **sí** se anota con su contenido: es la única forma de enterarse de que un modelo nuevo habla distinto.

### Reglas de la integración
- **Solo se contesta "OK" cuando el fichaje quedó guardado.** Si algo falla, se contesta error: el reloj conserva los registros y reintenta. Contestar bien sin haber guardado los borra del equipo.
- **Un reloj no dado de alta no recibe configuración ni se le aceptan fichajes.** El alta es por número de serie, desde la pestaña Reloj. Hasta entonces el equipo guarda todo y lo manda cuando se lo habilita.
- La hora la pone el reloj (el fichaje ocurrió ahí, no en el servidor) y se interpreta en hora argentina.
- **El desfasaje de hora se mide y se avisa, pero no se corrige solo.** Un comando de hora mal armado correría todos los fichajes; el aviso aparece a partir de 2 minutos de diferencia y se corrige en el equipo.
- **Nada se descarta.** Lo que todavía no se puede guardar queda en `clock_pending_punches` con el motivo:
    - `sin_legajo`: ese N° de reloj no está cargado en ningún legajo. Entra solo en cuanto se carga (trigger sobre `employees`).
    - `semana_cerrada`: entra al reabrir la semana y tocar **Reprocesar**.
- Los repetidos se descartan solos por la unicidad `(employee_id, punched_at, source)`, la misma que ya protegía la importación. Que un fichaje llegue por WiFi y después en un archivo es inofensivo.

### Si el reloj no habla HTTPS
Los firmwares viejos de ZKTeco empujan por HTTP plano, y ni Vercel ni Supabase aceptan HTTP. En ese caso el mismo `protocolo.js` corre en una máquina dentro de la fábrica (una Raspberry o una PC siempre encendida) que atiende en HTTP y reenvía. El traductor del protocolo es puro justamente para eso: no sabe dónde corre.

### Seguridad
- El endpoint está abierto en internet y lo único que identifica al equipo es su número de serie, que viaja en la URL.
- Mitigaciones: lista blanca de series (`clock_devices`), poder desactivar un equipo, y diario de contactos y rechazos (`clock_device_events`, que se poda solo a los 30 días).
- `ingest_clock_punches` y `touch_clock_device` son `security definer` y están **revocadas para los usuarios logueados**: solo las llama el servidor con la clave de servicio.
- Lo peor que puede hacer alguien que adivine una serie es inyectar fichajes, que el supervisor ve y anula. No hay lectura de datos.

### Casos de aceptación de la integración
Verificados contra un Postgres local (22 casos) y simulando al equipo contra el endpoint (16 casos):

1. Serie desconocida: no entra nada, queda el rechazo anotado y el reloj no recibe configuración.
2. Lote con un fichaje nuevo, uno repetido y uno de un N° sin legajo: entra uno, el repetido se descarta y el tercero queda en espera.
3. Reenviar el mismo lote no duplica nada.
4. Al cargar el N° en un legajo, lo que estaba en espera entra solo.
5. Fichaje de una semana cerrada: queda en espera; al reabrir y reprocesar, entra.
6. Filas ilegibles: se cuentan aparte y no rompen el lote.
7. Filas separadas por espacios en vez de tabulaciones: se leen igual.
8. Reloj adelantado 10 minutos: queda anotado el desfasaje.
9. Reloj desactivado: no se le aceptan fichajes.
10. Un usuario logueado no puede llamar a las funciones del endpoint.
11. Si la base falla, se contesta error y nunca "OK".

---

## Fichaje desde la app (técnico)

- Pantalla nueva **"Fichaje"** en la navegación del técnico (`/tecnico/fichaje`, ícono `fingerprint`).
- Dos botones grandes: **"Registrar entrada"** y **"Registrar salida"**. El técnico elige el tipo de forma **explícita**: la app no puede deducirlo, porque la entrada por huella todavía no está importada cuando el técnico ficha la salida en la calle.
- Al tocar un botón se abre una confirmación con el estilo de la app (nunca `alert`) que muestra:
    - el tipo;
    - la hora;
    - el estado de la ubicación.

  Si el último fichaje por app del técnico es del mismo tipo y tiene menos de 10 minutos, se muestra un aviso de posible duplicado.
- El botón queda deshabilitado mientras se guarda, para evitar el doble toque.
- Texto de ayuda visible: *"Los fichajes del reloj de fábrica aparecen cuando el supervisor importa el archivo."*

### Ubicación (obligatoria de registrar)
- Se usa `navigator.geolocation.getCurrentPosition` (API nativa): alta precisión, timeout de 15 s.
- Se guardan latitud, longitud y precisión en metros.
- **Si no se obtiene la ubicación** (permiso negado, GPS apagado, timeout):
    - el fichaje **se guarda igual**, marcado `sin_ubicacion` con el motivo (`permiso_denegado`, `no_disponible` o `tiempo_agotado`);
    - queda resaltado para que el supervisor lo revise.
- El supervisor ve la ubicación como enlace **"Ver en mapa"**: `https://www.google.com/maps?q=LAT,LNG`, en una pestaña nueva, sin librerías de mapas.
- **Rango de la fábrica:**
    - la distancia entre el fichaje y la fábrica se calcula con la fórmula de haversine (`Math` nativo), en una función pura (`src/features/timesheet/geo.js`);
    - el cálculo se hace al mostrar el fichaje, con la ubicación y el radio vigentes de la fábrica;
    - la leyenda "Fichado fuera de rango" la ve **solo el supervisor**. El técnico no la ve, ni al confirmar ni en su lista;
    - no aplica a los fichajes del reloj ni a los manuales, que no tienen ubicación.

### Sin conexión
- El fichaje funciona offline, igual que el formulario de visita.
- Se guarda en IndexedDB con la **hora y la ubicación del momento** y se sube al reconectar.
- Queda marcado **"registrado sin conexión"** (`recorded_offline = true`).
- Con conexión, la hora la pone **el servidor** (`now()`), no el celular, para que no se pueda manipular.
- Cada fichaje lleva un `id` generado en el cliente (`crypto.randomUUID()`), así los reintentos de sincronización nunca lo duplican.

### Consulta propia (solo lectura)
- Debajo de los botones, el técnico ve **sus fichajes de la semana** (reloj, app y correcciones del supervisor) y **sus horas calculadas** con el mismo motor que el reporte.
- No puede editar ni anular nada. Si se equivocó, avisa al supervisor.

---

## Reglas de cálculo de horas

Configuración **igual para todos**. Las reglas viven como constantes en `src/lib/constants.js` (`TIMESHEET_RULES`), sin pantalla de configuración:

| Regla | Valor |
|---|---|
| Jornada normal | **9 h**, lunes a viernes (45 h semanales). Horario habitual de 8 a 18 h con 1 h de almuerzo. El sábado no es laborable. |
| Pago por tiempo trabajado | Se paga desde el fichaje de entrada hasta el de salida. Llegar tarde está permitido y se cobra desde ese momento (ej.: entra 08:20, cobra desde las 08:20). No hay tolerancias, penalizaciones ni horario obligatorio. |
| Cálculo de extras | **Por día**: lo que excede las 9 h de cada día hábil. |
| Descuento de almuerzo | **60 min, siempre y por igual**, en cada día hábil (L–V no feriado) con horas trabajadas. Sin excepciones ni ajustes manuales. Nunca deja un día en negativo. |
| Pausa fichada | Si en el día hay pausas fichadas (salida y nueva entrada), el descuento es `máx(0, 60 − minutos de pausa fichada)`. **Nunca se descuenta dos veces.** |
| Sábado | Sin descuento. Hasta las 13:00 al **50%**, después de las 13:00 al **100%**. |
| Domingo | Sin descuento. Todo al **100%**. |
| Feriado de lunes a viernes | Se cobra **siempre como un día normal**: suma 9 h normales, se trabaje o no. Si además se trabaja, esas horas se pagan aparte, al **100%** y sin descuento de almuerzo. |
| Feriado en sábado o domingo | Sin trabajar no suma horas. Si se trabaja, todo al **100%**. |
| Redondeo | **Ninguno**: minutos exactos. |
| Semana | **Lunes a domingo.** Reutilizar `startOfWeek` de `src/lib/dateUtils.js`, que ya arranca el lunes. |
| Zona horaria | `America/Argentina/Buenos_Aires`, vía `Intl.DateTimeFormat` (nativo). Días, horas y el corte de las 13:00 se calculan en esa zona, nunca en la zona del navegador. |

### Algoritmo por empleado
1. Tomar los fichajes **no anulados**, ordenados por fecha y hora.
2. **Rebote del reloj:** un fichaje del reloj a menos de 2 minutos del anterior del mismo empleado se ignora (doble apoyo del dedo).
3. **Tipo de cada fichaje:**
    - Los fichajes de app y manuales traen tipo explícito.
    - Los del reloj se infieren por alternancia: si el empleado está "afuera" es entrada, si está "adentro" es salida.
4. **Armar tramos** (entrada → salida). Varias entradas y salidas por día están permitidas y se suman.
5. **Inconsistencias:** el día queda **"fichaje incompleto"** y **no suma horas** hasta que el supervisor lo corrija. Son inconsistencias:
    - una entrada sin salida;
    - una salida sin entrada;
    - dos entradas explícitas seguidas;
    - un tramo de más de 16 h.
6. **Cruce de medianoche:** el tramo se parte a las 00:00 y cada parte se clasifica según su propio día.
7. **Por cada día:** calcular los minutos trabajados y la pausa fichada, aplicar el descuento si corresponde y clasificar en normales, al 50% y al 100% según la tabla.
8. **Por semana:** sumar por empleado las horas normales, al 50%, al 100%, el total y la cantidad de días incompletos.

El motor va en funciones **puras**, sin React ni Supabase (ej. `src/features/timesheet/computeTimesheet.js`), y se usa igual en:
- el reporte del supervisor;
- la vista del técnico;
- la foto que se guarda al cerrar la semana.

### Casos de aceptación (el motor debe dar exactamente esto)

| # | Situación | Resultado |
|---|---|---|
| 1 | Mar: entrada reloj 08:00, salida app 18:00 (día habitual) | 10:00 − 1:00 → **9:00 normales** |
| 2 | Mar: entrada reloj 08:20 (llegó tarde), salida app 18:00 | 9:40 − 1:00 → **8:40 normales** (cobra desde que fichó) |
| 3 | Mar: entrada app 08:00, salida app 19:30 | 11:30 − 1:00 = 10:30 → **9:00 normales + 1:30 al 50%** |
| 4 | Mié: reloj 08:00, 12:00, 13:00, 18:00 | 9:00 con 60 min de pausa fichada → sin descuento → **9:00 normales** |
| 5 | Jue: reloj 08:00, 12:30, 13:00, 18:30 | 10:00 con 30 min de pausa fichada → descuento de 30 → 9:30 → **9:00 normales + 0:30 al 50%** |
| 6 | Vie: reloj 08:00, salida 13:00 | 5:00 − 1:00 → **4:00 normales** (mismo descuento que cualquier día) |
| 7 | Sáb: 10:00 a 15:00 | **3:00 al 50% + 2:00 al 100%** |
| 8 | Dom: 09:00 a 12:00 | **3:00 al 100%** |
| 9 | Mié feriado trabajado: 08:00 a 18:00 | **9:00 normales** (feriado pago) **+ 10:00 al 100%** (sin descuento) |
| 10 | Mié feriado sin fichajes | **9:00 normales** (feriado pago) |
| 11 | Sáb feriado sin fichajes | **0:00** (el sábado no es laborable). Si se trabaja de 10:00 a 15:00: **5:00 al 100%**. |
| 12 | Lun: entrada reloj 08:00, sin salida | **Día incompleto, 0:00**, con alerta. Si el supervisor agrega la salida de las 18:00 con motivo, pasa a **9:00 normales**. |
| 13 | Reloj 08:00:05 y 08:00:40 | El segundo se ignora por rebote |
| 14 | Salida app 18:00 sin señal, sube a las 20:15 | Hora 18:00, marcado **"registrado sin conexión"** |
| 15 | Salida app con el permiso de ubicación negado | Se guarda, marcado **"sin ubicación"** |
| 16 | Fábrica con radio de 500 m. Entrada app a 300 m de la fábrica | Sin leyenda |
| 17 | Fábrica con radio de 500 m. Salida app a 3,2 km, en un cliente | El supervisor ve **"Fichado fuera de rango · 3,2 km"**. Las horas no cambian. |

---

## Supervisor

Nuevo ítem **"Fichajes"** en la navegación del supervisor (`/supervisor/fichajes`, ícono `fingerprint`), con pestañas:

### 1. Semana (vista principal)
- Selector de semana (lunes a domingo).
- A la derecha del texto de cada día, un **check con la leyenda "Feriado"** (si la columna es angosta, pasa debajo del día):
    - tildado, ese día es feriado para todo el personal: de lunes a viernes se cobra como un día normal (9 h) y lo trabajado se paga aparte, al 100% y sin descuento de almuerzo;
    - destildado, vuelve a ser un día común;
    - con la semana cerrada no se puede cambiar.
- Tabla de **empleados × días** con las horas de cada día y distintivos:
    - incompleto (rojo);
    - sin ubicación;
    - sin conexión;
    - con corrección manual;
    - fichado fuera de rango.
- Al hacer clic en una celda se abre el **detalle del día**:
    - lista de fichajes con hora, origen (reloj, app o manual), tipo, ubicación ("Ver en mapa" y precisión) y marcas;
    - en los fichajes por app a más distancia de la fábrica que el radio configurado, la leyenda **"Fichado fuera de rango"** con la distancia (ej. *"Fichado fuera de rango · 3,2 km"*). Es solo informativa: no bloquea nada ni cambia las horas;
    - los anulados se muestran **tachados** con su motivo.
- **Correcciones** (solo el supervisor, **motivo obligatorio** en todas):
    - **Agregar** fichaje manual (tipo + fecha y hora).
    - **Anular** fichaje. Nunca se borra: queda con `voided_at`, `voided_by` y `void_reason`.
    - **Corregir hora**: anula el original y crea uno manual que lo referencia (`replaces_punch_id`). El original siempre se conserva.

#### Feriados oficiales (botón en la pestaña Semana)
- Trae el **calendario oficial de feriados nacionales** del año y lo muestra para confirmar. **Nunca marca nada solo**: son horas que se pagan.
- Clasificación, que es lo que evita pagar de más:
    - `inamovible` y `trasladable` son feriados: llegan **tildados**;
    - `puente` (puente turístico) es un **día no laborable**, no un feriado: llega **sin tildar**, porque si se trabaja se paga como un día común. Si en la fábrica lo tratan como feriado, se tilda a mano;
    - cualquier tipo nuevo que el calendario agregue y no conozcamos llega sin tildar.
- Los días que ya están marcados aparecen como "Ya cargado" y no se tocan: no se pisa lo que marcó el supervisor.
- Los días de una semana cerrada aparecen como "Semana cerrada" y quedan afuera (la base los rechaza, ver 0022).
- Selector de año: el de la semana que se está viendo y el siguiente, para cargar el año que viene en diciembre.
- La fuente vive en un solo archivo (`officialHolidays.js`). Si deja de funcionar, se avisa en pantalla y los feriados se siguen marcando a mano con el check de cada día.
- Fechas ilegibles o imposibles (`2026-02-31`) se descartan antes de tocar la base: una sola fecha inválida haría fallar la carga entera.

### 2. Reporte semanal
- Una fila por empleado: legajo, nombre, **horas normales, al 50%, al 100%, total** y días incompletos. Formato `hh:mm`.
- Detalle por día desplegable.
- **Exportar CSV** reutilizando `rowsToCsv` y `downloadCsv` de `src/lib/csv.js` (ya incluye el BOM para Excel).
- **Cerrar semana:**
    - no se puede cerrar si hay días incompletos (se explica cuáles);
    - al cerrar se guarda una **foto** del reporte (`snapshot` jsonb) y la semana queda bloqueada;
    - el reporte y el CSV de una semana cerrada salen de esa foto.
- **Reabrir semana:** con motivo obligatorio. Cierres y reaperturas quedan en un historial.

### 3. Reloj (equipos conectados por WiFi)
- **Cómo se conecta**: la dirección y el puerto que hay que cargarle al equipo, a la vista para copiarlos.
- **Alta del reloj**: nombre y número de serie. Sin esto el servidor no le acepta fichajes.
- **Estado de cada equipo**: conectado o sin contacto (se considera caído a los 30 min sin comunicarse), fichajes recibidos, último fichaje, último contacto, dirección de red y botón para activarlo o desactivarlo.
- **Aviso de hora corrida** cuando el desfasaje pasa los 2 minutos.
- **Fichajes en espera**, con el motivo (sin legajo o semana cerrada) y el botón **Reprocesar**.
- **Últimos movimientos**: el diario del equipo, para la puesta en marcha y para diagnosticar cuando deja de aparecer.

### 4. Importar reloj (respaldo)
- Subir el archivo (se lee con `file.text()`, nativo).
- **Vista previa antes de confirmar**, con:
    - filas leídas;
    - fichajes nuevos;
    - duplicados, que se ignoran;
    - legajos desconocidos, que no se importan y se listan para dar de alta;
    - filas de semanas cerradas, que no se importan.
- Reimportar el mismo archivo es seguro: los duplicados se detectan por empleado + fecha y hora + origen.
- Historial de importaciones: fecha, archivo, quién la hizo y conteos.

### 5. Fábrica
- Ubicación de la fábrica para detectar los fichajes por app hechos lejos de ella:
    - nombre;
    - latitud y longitud;
    - **radio en metros, 500 m por defecto**, editable (ej. 500 m o 1.000 m).
- Dos formas de cargar la ubicación:
    - botón **"Usar mi ubicación actual"**, estando en la fábrica (geolocalización nativa);
    - pegar las coordenadas copiadas de Google Maps (ej. `-34.6037, -58.3816`).
- Enlace **"Ver en mapa"** para comprobar que quedó bien cargada.
- Mientras no haya una ubicación cargada, no se calcula el rango y no aparece ninguna leyenda.

### Empleados (dentro de "Personal", sección existente)
- Nueva lista y alta de **empleados de fábrica**: nombre completo, DNI, **N° en el reloj**, teléfono, activo.
- En el alta y el detalle del personal **con usuario** se agrega el campo **"N° en el reloj"**, que vincula su legajo.

### Alertas en el Panel de Control
- `DashboardPage` es compartido con el administrativo: la tarjeta nueva se muestra **solo al supervisor**.
- Contadores de la semana en curso, cada uno con acceso directo al detalle para corregir:
    - fichajes incompletos;
    - fichajes sin ubicación;
    - fichajes registrados sin conexión;
    - fichajes llegados con la semana ya cerrada.

---

## Base de datos (Supabase)

Migraciones, que el usuario aplica pegándolas en el SQL Editor del Dashboard, en este orden:
1. `supabase/migrations/0021_fichaje.sql`: el módulo completo. Ya aplicada.
2. `supabase/migrations/0022_feriados_semana.sql`: check de feriado en la vista Semana, bloqueo de feriados con la semana cerrada y versión final de las políticas del técnico. Ya aplicada. Se puede correr más de una vez.
3. `supabase/migrations/0025_reloj_push.sql`: integración directa con el reloj por WiFi (equipos, fichajes en espera, diario y las funciones que usa el endpoint). Se puede correr más de una vez.

Nombres de tablas en inglés y valores en español, igual que el resto del esquema.

### Tablas

- **`employees`** (legajo): `id`, `full_name`, `dni`, `clock_pin` (N° en el reloj, único), `phone`, `profile_id` (nullable, único, FK a `profiles`), `active`, `created_at`.
    - La migración crea un legajo para cada `profiles` existente, sin `clock_pin`.
- **`time_punches`** (fichajes): `id` (uuid, lo puede generar el cliente), `employee_id`, `punched_at` (timestamptz), `received_at` (default `now()`), `source` (`reloj` | `app` | `manual`), `punch_type` (`entrada` | `salida` | null para el reloj), `latitude`, `longitude`, `accuracy_m`, `location_status` (`ok` | `sin_ubicacion` | null), `location_error`, `recorded_offline`, `arrived_after_close`, `import_id`, `replaces_punch_id`, `reason` (motivo de los manuales), `created_by`, `voided_at`, `voided_by`, `void_reason`.
    - Único `(employee_id, punched_at, source)`, que evita los duplicados de importación.
- **`punch_imports`**: `id`, `file_name`, `imported_by`, `imported_at`, `rows_total`, `rows_inserted`, `rows_duplicated`, `rows_unknown`, `rows_closed_week`.
- **`holidays`**: `date` (PK), `name` (desde 0022 vale "Feriado" por defecto: el check no pide nombre). Una fila por cada día marcado con el check de feriado.
- **`timesheet_weeks`**: `week_start` (date, PK, siempre lunes), `status` (`abierta` | `cerrada`), `closed_by`, `closed_at`, `snapshot` (jsonb).
- **`timesheet_week_events`**: `id`, `week_start`, `action` (`cerrada` | `reabierta`), `reason`, `actor_id`, `created_at`.
- **`timesheet_settings`** (una sola fila): `id` (boolean, PK, `check (id)`), `factory_name`, `factory_latitude`, `factory_longitude`, `factory_radius_m` (default `500`, `check > 0`), `updated_by`, `updated_at`.
- **`clock_devices`** (0025): `id`, `serial_number` (único), `name`, `active`, `last_seen_at`, `last_push_at`, `last_ip`, `attlog_stamp` (desde dónde sigue mandando el equipo), `clock_offset_seconds` (desfasaje medido), `punches_received`, `created_at`, `created_by`.
- **`clock_pending_punches`** (0025): fichajes que llegaron y todavía no se pueden guardar. `device_id`, `clock_pin`, `punched_at`, `reason` (`sin_legajo` | `semana_cerrada`), único `(clock_pin, punched_at)`.
- **`clock_device_events`** (0025): diario del equipo. `device_id`, `serial_number`, `kind` (`contacto` | `fichajes` | `rechazo`), `detail` jsonb. Se borra solo a los 30 días.
- **`time_punches.device_id`** (0025): qué reloj mandó el fichaje.

### Seguridad (RLS)
- Nuevo helper `current_employee_id()` con `security definer`, mismo patrón que `current_staff_role()`.
- **Supervisor:** acceso total a todas las tablas del módulo.
- **Técnico:**
    - `select` de su propio legajo y de sus fichajes;
    - `insert` en `time_punches` solo si es su `employee_id`, `source = 'app'`, `created_by = auth.uid()` y sin anular;
    - `select` de `holidays` (lo necesita para calcular sus horas);
    - nada de `update` ni `delete`;
    - sin acceso a `timesheet_settings`, porque no ve la leyenda de rango.
- **Administrativo:** sin acceso (sin políticas).

### Triggers
- **Hora del servidor:** si `source = 'app'` y `recorded_offline = false`, se fuerza `punched_at := now()`.
- **Semana cerrada:**
    - un fichaje de app que llega sincronizado a una semana cerrada **se acepta** con `arrived_after_close = true` (no se pierde el dato) y dispara la alerta al supervisor;
    - cualquier otro alta o edición en una semana cerrada se rechaza con el mensaje *"La semana está cerrada. Reabrila para modificar fichajes."*
- **Feriados:** con la semana cerrada no se puede marcar ni desmarcar un feriado de esa semana.

---

## Offline (técnico)

- Extender `src/offline/*`, sin cliente Supabase nuevo por fuera.
- En `src/offline/db.js`:
    - subir `DB_VERSION` a 2;
    - agregar el store `pendingPunches` con `keyPath: 'id'`. El store `pendingWrites` actual está indexado por `visitId` y no sirve para esto.
- La cola de fichajes se sincroniza con la misma detección de red y el mismo `SyncStatusBar` que las visitas.
- El insert usa el `id` del cliente, así un reintento nunca duplica.

---

## Estructura de archivos sugerida

```
api/iclock.js                    ← endpoint que atiende al reloj por WiFi (Vercel)
api/_reloj/protocolo.js          ← traducción del protocolo push, pura y portable
src/api/timePunches.js           ← fichajes, importación, correcciones
src/api/clockDevices.js          ← relojes, fichajes en espera, diario
src/api/employees.js
src/api/holidays.js
src/api/timesheetWeeks.js
src/api/timesheetSettings.js     ← ubicación y radio de la fábrica
src/hooks/useTimesheetWeek.js
src/features/timesheet/computeTimesheet.js   ← motor puro de cálculo
src/features/timesheet/clockFileParser.js    ← CSV genérico + ZKTeco (aislado)
src/features/timesheet/WeekGrid.jsx
src/features/timesheet/DayPunchesModal.jsx
src/features/timesheet/PunchCorrectionModal.jsx
src/features/timesheet/WeeklyReportTable.jsx
src/features/timesheet/ImportClockFile.jsx
src/features/timesheet/ClockDevicesSection.jsx
src/features/timesheet/OfficialHolidaysModal.jsx
src/features/timesheet/officialHolidays.js   ← calendario oficial de feriados (unica fuente externa)
src/features/timesheet/FactoryLocationSettings.jsx
src/features/timesheet/geo.js                ← distancia (haversine), función pura
src/features/dashboard/TimesheetAlerts.jsx
src/pages/supervisor/TimesheetPage.jsx       ← pestañas Semana / Reporte / Importar / Fábrica
src/pages/tecnico/PunchPage.jsx
src/offline/punchQueue.js
```

---

## Reglas de desarrollo

- Todo lo de CLAUDE.md sigue vigente:
    - textos en español;
    - `rem` con base de 10px;
    - HTML semántico;
    - `const` y `let`, nunca `var`;
    - sin `alert` ni modales nativos;
    - `preventDefault` en submit y click;
    - responsive (la pantalla del técnico se piensa primero para celular).
- **Sin dependencias nuevas.** Geolocalización, IndexedDB, lectura de archivos, CSV y zona horaria se resuelven con APIs nativas.
- Reutilizar los componentes existentes: `Modal`, `ConfirmModal`, `Button`, `Field`, `StatusChip`, `KpiCard`, `EmptyState`, `Spinner`.
- Diseño y colores de la carpeta `Desing`.
- Trabajar en la rama **`feature/fichaje`**, nunca en `main`.

## Orden de desarrollo

1. **Base de datos:** migración `0021_fichaje.sql` (tablas, RLS, triggers). La aplica el usuario.
2. **Motor de cálculo:** `computeTimesheet.js`, verificado contra los 17 casos de aceptación (los casos 16 y 17 verifican `geo.js`) antes de construir cualquier pantalla.
3. **Empleados:** alta de empleados de fábrica y el campo "N° en el reloj" en Personal.
4. **Fichaje del técnico:** online con ubicación, después la cola offline, después su vista de solo lectura.
5. **Supervisor, Semana:** grilla, check de feriado por día, detalle del día y correcciones con motivo.
6. **Supervisor, Reporte:** tabla, CSV, cierre y reapertura.
7. **Importación del reloj:** parser, vista previa e historial. Ubicación de la fábrica y leyenda "Fichado fuera de rango".
8. **Alertas** en el Panel de Control del supervisor.

---

## Supuestos por defecto (confirmar o corregir)

Estos detalles no se definieron explícitamente. Se tomó la opción más razonable:

- **Pausas largas:** cualquier hueco entre tramos del mismo día cuenta como pausa fichada. Ej.: quien trabaja de 8 a 18 y vuelve a una guardia de 22 a 24 no tiene descuento, porque la pausa fichada supera los 60 min.
- **Límites técnicos:**
    - rebote del reloj: 2 min;
    - tramo máximo: 16 h;
    - aviso de posible duplicado en la app: 10 min.
- **Fichajes que llegan offline con la semana ya cerrada:** se aceptan, se marcan y generan una alerta. No se descartan.
- **Formato ZKTeco:** se ajusta con un archivo real del equipo que se compre.
