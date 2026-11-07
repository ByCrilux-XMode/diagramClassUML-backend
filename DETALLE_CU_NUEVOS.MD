# DETALLE DE CASOS DE USO NUEVOS — Versiones y Notificaciones

Metodología: PUDS. Actores: A1 Visitante, A2 Usuario. Todos los casos corresponden al ciclo 1.

> **Numeración:** esta lista continúa desde **CU23** para no chocar con los casos ya referenciados en `FLUJO_IMPLEMENTACION.MD`: CU18 (colaboración en tiempo real) y CU19–CU22 (export/import y asistente IA). Los CU01–CU17 están documentados en `DETALLE_CU.MD`.

---

## Inventario de casos de uso

| Id | Nombre | Actor | Endpoint principal |
|---|---|---|---|
| CU01 | Registrarse | A1 Visitante | `POST /auth/registrarse` |
| CU02 | Iniciar Sesión | A1 Visitante | `POST /auth/iniciar-sesion` |
| CU03 | Cerrar Sesión | A2 Usuario | `POST /auth/cerrar-sesion` |
| CU04 | Ver mi Perfil | A2 Usuario | `GET /usuarios/me` |
| CU05 | Ver Mis Proyectos | A2 Usuario | `GET /usuarios/me/proyectos` |
| CU06 | Crear Proyecto | A2 Usuario | `POST /proyectos` |
| CU07 | Listar Proyectos | A2 Usuario | `GET /proyectos` |
| CU08 | Ver Detalle de Proyecto | A2 Usuario | `GET /proyectos/:id` |
| CU09 | Modificar Proyecto | A2 Usuario | `PATCH /proyectos/:id` |
| CU10 | Eliminar Proyecto | A2 Usuario | `DELETE /proyectos/:id` |
| CU11 | Listar Colaboradores de un Proyecto | A2 Usuario | `GET /proyectos/:proyectoId/colaboradores` |
| CU12 | Asignar Colaborador a un Proyecto | A2 Usuario | `POST /proyectos/:proyectoId/colaboradores` |
| CU13 | Cambiar Permiso de un Colaborador | A2 Usuario | `PATCH /proyectos/:proyectoId/colaboradores/:usuarioId` |
| CU14 | Remover Colaborador de un Proyecto | A2 Usuario | `DELETE /proyectos/:proyectoId/colaboradores/:usuarioId` |
| CU15 | Listar Permisos | A2 Usuario | `GET /permisos` |
| CU16 | Editar Diagrama de Clases UML | A2 Usuario | `PATCH /proyectos/:id` |
| CU17 | Visualizar Diagrama de Clases UML | A2 Usuario | `GET /proyectos/:id` |
| CU18 | Colaboración en Tiempo Real | A2 Usuario | WS `/colaboracion` + `POST /proyectos/:id/guardar-colaboracion` |
| CU19 | Exportar Diagrama | A2 Usuario | Referenciado en `FLUJO_IMPLEMENTACION.MD` |
| CU20 | Importar Diagrama | A2 Usuario | Referenciado en `FLUJO_IMPLEMENTACION.MD` |
| CU21 | Asistente IA: proponer cambios | A2 Usuario | Referenciado en `FLUJO_IMPLEMENTACION.MD` |
| CU22 | Asistente IA: aplicar cambios | A2 Usuario | Referenciado en `FLUJO_IMPLEMENTACION.MD` |
| **CU23** | **Registrar o actualizar token FCM** | **A2 Usuario** | `POST /auth/iniciar-sesion` / `PUT /usuarios/me/token-firebase` |
| **CU24** | **Eliminar token FCM** | **A2 Usuario** | `DELETE /usuarios/me/token-firebase` |
| **CU25** | **Consultar notificaciones** | **A2 Usuario** | `GET /notificaciones` |
| **CU26** | **Marcar notificación como leída** | **A2 Usuario** | `PATCH /notificaciones/:id/leida` |
| **CU27** | **Marcar todas las notificaciones como leídas** | **A2 Usuario** | `PATCH /notificaciones/leidas` |
| **CU28** | **Recibir notificación push por acción en proyecto** | **A2 Usuario** | Push FCM (sin endpoint propio) |
| **CU29** | **Listar versiones de un proyecto** | **A2 Usuario** | `GET /proyectos/:id/versiones` |
| **CU30** | **Ver detalle de una versión** | **A2 Usuario** | `GET /proyectos/:id/versiones/:versionId` |
| **CU31** | **Crear versión manual** | **A2 Usuario** | `POST /proyectos/:id/versiones` |
| **CU32** | **Restaurar versión** | **A2 Usuario** | `POST /proyectos/:id/versiones/:versionId/restaurar` |
| **CU33** | **Eliminar versión** | **A2 Usuario** | `DELETE /proyectos/:id/versiones/:versionId` |
| **CU34** | **Consultar usuarios para asignar colaborador** | **A2 Usuario** | `GET /usuarios` / `GET /usuarios/username/:username` |

---

## CU23 — Registrar o actualizar token FCM

| Campo | Detalle |
|-------|---------|
| Id | CU23 |
| nombre | Registrar o actualizar token FCM |
| proposito | Permitir que el backend asocie el token FCM del dispositivo móvil al usuario autenticado, para poder enviarle notificaciones push |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa o está iniciando sesión; la app Flutter obtuvo un token mediante Firebase Messaging |
| flujo principal | 1. La app obtiene el token con `FirebaseMessaging.instance.getToken()`. 2. La app envía el token en `POST /auth/iniciar-sesion` como `tokenFirebase`, o después del login con `PUT /usuarios/me/token-firebase`. 3. El sistema autentica la solicitud (credenciales en el login o cookie JWT en el endpoint). 4. El sistema valida que el token no esté vacío y no supere 512 caracteres. 5. El sistema actualiza `usuario.token_firebase`. 6. El sistema responde con el usuario (login) o HTTP 204 (endpoint). |
| postcondicion | El token FCM queda asociado al usuario y el dispositivo puede recibir push |
| excepcion | Si el token está vacío o supera 512 caracteres, HTTP 400; si las credenciales o la cookie son inválidas, HTTP 401; si el usuario no existe, HTTP 404. Si la app no envía token, el login continúa sin registrar token |

---

## CU24 — Eliminar token FCM

| Campo | Detalle |
|-------|---------|
| Id | CU24 |
| nombre | Eliminar token FCM |
| proposito | Permitir que el usuario desvincule el dispositivo actual para dejar de recibir notificaciones push en él |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa y el dispositivo tiene un token FCM registrado |
| flujo principal | 1. La app solicita `DELETE /usuarios/me/token-firebase` antes de cerrar sesión. 2. El sistema autentica la solicitud mediante la cookie JWT. 3. El sistema actualiza `usuario.token_firebase` a `null`. 4. El sistema responde HTTP 204. |
| postcondicion | El token del dispositivo queda eliminado y el usuario deja de recibir push en ese dispositivo |
| excepcion | Si la cookie no es válida o expiró, HTTP 401; si el usuario no existe, HTTP 404 |

---

## CU25 — Consultar notificaciones

| Campo | Detalle |
|-------|---------|
| Id | CU25 |
| nombre | Consultar notificaciones |
| proposito | Permitir al usuario consultar el historial de notificaciones que recibió por acciones realizadas en sus proyectos |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa |
| flujo principal | 1. El usuario solicita `GET /notificaciones` con paginación opcional (`pagina`, `limite`). 2. El sistema autentica la solicitud. 3. El sistema consulta las notificaciones cuyo destinatario es el usuario autenticado. 4. El sistema las ordena por `creadaEn` descendente. 5. El sistema cuenta las notificaciones no leídas. 6. El sistema responde con `datos`, `total` y `noLeidas`. |
| postcondicion | El usuario visualiza su historial de notificaciones y el número de no leídas |
| excepcion | Si la paginación es inválida, HTTP 400; si la cookie no es válida, HTTP 401 |

---

## CU26 — Marcar notificación como leída

| Campo | Detalle |
|-------|---------|
| Id | CU26 |
| nombre | Marcar notificación como leída |
| proposito | Permitir al usuario marcar una notificación concreta como leída |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa y la notificación pertenece al usuario |
| flujo principal | 1. El usuario solicita `PATCH /notificaciones/:id/leida`. 2. El sistema autentica la solicitud. 3. El sistema busca la notificación por ID y destinatario. 4. Si ya estaba leída, no modifica nada. 5. Si no estaba leída, actualiza `leida = true`. 6. El sistema responde con la notificación actualizada. |
| postcondicion | La notificación queda marcada como leída |
| excepcion | Si el ID no es numérico, HTTP 400; si la cookie no es válida, HTTP 401; si la notificación no existe o pertenece a otro usuario, HTTP 404 |

---

## CU27 — Marcar todas las notificaciones como leídas

| Campo | Detalle |
|-------|---------|
| Id | CU27 |
| nombre | Marcar todas las notificaciones como leídas |
| proposito | Permitir al usuario marcar como leídas todas sus notificaciones pendientes de una sola vez |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa |
| flujo principal | 1. El usuario solicita `PATCH /notificaciones/leidas`. 2. El sistema autentica la solicitud. 3. El sistema obtiene las notificaciones no leídas del usuario. 4. Si no hay pendientes, termina sin cambios. 5. El sistema actualiza todas a `leida = true`. 6. El sistema responde HTTP 204. |
| postcondicion | Todas las notificaciones del usuario quedan marcadas como leídas |
| excepcion | Si la cookie no es válida, HTTP 401 |

---

## CU28 — Recibir notificación push por acción en proyecto

| Campo | Detalle |
|-------|---------|
| Id | CU28 |
| nombre | Recibir notificación push por acción en proyecto |
| proposito | Notificar a los miembros de un proyecto (excepto al actor) cuando otro miembro guarda el esquema o restaura una versión |
| actor | A2 Usuario (destinatario) |
| actor iniciador | Otro A2 Usuario que realiza la acción, o el sistema al detectar la acción |
| precondicion | El destinatario es creador o colaborador del proyecto; el actor realizó una acción notificable; para recibir push, el destinatario tiene `tokenFirebase` registrado |
| flujo principal | 1. Un miembro guarda el esquema con `PATCH /proyectos/:id` incluyendo `esquemaJson`, guarda la colaboración con `POST /proyectos/:id/guardar-colaboracion`, o restaura una versión con `POST /proyectos/:id/versiones/:versionId/restaurar`. 2. El sistema verifica los permisos correspondientes. 3. Si es un guardado, el sistema crea la versión automática; si es una restauración, no crea una versión nueva. 4. El sistema obtiene como destinatarios al creador y a todos los colaboradores, excluyendo al actor. 5. El sistema genera título y mensaje según la acción (`PROYECTO_GUARDADO` o `VERSION_RESTAURADA`). 6. El sistema guarda una fila en `notificacion` por cada destinatario. 7. El sistema envía el push FCM a los destinatarios que tengan token. 8. Si el envío es exitoso, marca `enviada = true`. 9. La app muestra la notificación y puede navegar al proyecto usando `datos.proyectoId`. |
| postcondicion | Cada destinatario tiene una notificación en su historial y, si tiene token, recibe el push |
| excepcion | Si no hay destinatarios (el actor es el único miembro), no se guarda ni envía nada; si un destinatario no tiene token, se guarda la fila con `enviada = false`; si Firebase Admin no está configurado o falla el envío, se registra un aviso y la acción principal continúa; si el actor no tiene permiso de escritura, la acción falla con HTTP 403 y no se notifica |

**Acciones que no generan notificación:** crear proyecto, cambiar solo el nombre, crear una versión manual, asignar/cambiar/remover colaboradores, eliminar proyecto, iniciar sesión y el autoguardado de Yjs.

---

## CU29 — Listar versiones de un proyecto

| Campo | Detalle |
|-------|---------|
| Id | CU29 |
| nombre | Listar versiones de un proyecto |
| proposito | Permitir al usuario consultar el historial de versiones guardadas de un proyecto |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa |
| flujo principal | 1. El usuario solicita `GET /proyectos/:id/versiones` con paginación opcional. 2. El sistema autentica la solicitud. 3. El sistema consulta las versiones del proyecto. 4. El sistema las ordena por `creadaEn` descendente e incluye el autor (`creadoPor` con su persona). 5. El sistema responde con `datos` y `total`. |
| postcondicion | El usuario visualiza las versiones del proyecto, de la más reciente a la más antigua |
| excepcion | Si los parámetros son inválidos, HTTP 400; si el proyecto no existe, el sistema devuelve una lista vacía; si la cookie no es válida, HTTP 401 |

---

## CU30 — Ver detalle de una versión

| Campo | Detalle |
|-------|---------|
| Id | CU30 |
| nombre | Ver detalle de una versión |
| proposito | Permitir al usuario consultar una versión concreta con su nombre, descripción, fecha, autor y esquema completo |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa y la versión pertenece al proyecto indicado |
| flujo principal | 1. El usuario solicita `GET /proyectos/:id/versiones/:versionId`. 2. El sistema autentica la solicitud. 3. El sistema busca la versión por ID y proyecto. 4. El sistema responde con los datos completos de la versión. |
| postcondicion | El usuario visualiza el detalle y el esquema de la versión |
| excepcion | Si los IDs no son numéricos, HTTP 400; si la versión no existe o no pertenece al proyecto, HTTP 404; si la cookie no es válida, HTTP 401 |

---

## CU31 — Crear versión manual

| Campo | Detalle |
|-------|---------|
| Id | CU31 |
| nombre | Crear versión manual |
| proposito | Permitir al creador o a un colaborador EDITOR guardar una versión con nombre y descripción personalizados usando el esquema actual del proyecto |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa, es creador o EDITOR del proyecto, y el proyecto existe |
| flujo principal | 1. El usuario solicita `POST /proyectos/:id/versiones` con `nombre` y/o `descripcion` opcionales. 2. El sistema autentica la solicitud. 3. El sistema verifica que el proyecto existe y que el usuario tiene permiso de escritura. 4. El sistema toma el `esquemaJson` actual del proyecto. 5. El sistema crea la versión con el nombre indicado o `Versión N` si se omite. 6. El sistema responde HTTP 201 con la versión creada. |
| postcondicion | La versión queda registrada en el historial del proyecto |
| excepcion | Si el nombre supera 150 caracteres o la descripción 1000, HTTP 400; si el usuario no es creador ni EDITOR, HTTP 403; si el proyecto no existe, HTTP 404; si la cookie no es válida, HTTP 401. Esta acción no genera notificación |

---

## CU32 — Restaurar versión

| Campo | Detalle |
|-------|---------|
| Id | CU32 |
| nombre | Restaurar versión |
| proposito | Permitir al creador o a un colaborador EDITOR devolver el proyecto a un estado guardado previamente |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa, es creador o EDITOR del proyecto, y la versión existe y pertenece al proyecto |
| flujo principal | 1. El usuario solicita `POST /proyectos/:id/versiones/:versionId/restaurar`. 2. El sistema autentica la solicitud. 3. El sistema verifica que el proyecto existe y que el usuario tiene permiso de escritura. 4. El sistema busca la versión. 5. El sistema aplica el esquema de la versión al documento colaborativo en vivo y al esquema temporal. 6. El sistema actualiza `proyecto.esquemaJson`. 7. El sistema notifica a los demás miembros con `VERSION_RESTAURADA`. 8. El sistema responde HTTP 200 con el proyecto actualizado. |
| postcondicion | El proyecto queda restaurado, la versión original se conserva sin duplicarse y los demás miembros reciben la notificación |
| excepcion | Si los IDs no son numéricos, HTTP 400; si el usuario no es creador ni EDITOR, HTTP 403; si el proyecto o la versión no existen, HTTP 404; si la cookie no es válida, HTTP 401 |

---

## CU33 — Eliminar versión

| Campo | Detalle |
|-------|---------|
| Id | CU33 |
| nombre | Eliminar versión |
| proposito | Permitir al creador o a un colaborador EDITOR eliminar una versión concreta del historial del proyecto |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa, es creador o EDITOR del proyecto, y la versión existe y pertenece al proyecto |
| flujo principal | 1. El usuario solicita `DELETE /proyectos/:id/versiones/:versionId`. 2. El sistema autentica la solicitud. 3. El sistema verifica que el proyecto existe y que el usuario tiene permiso de escritura. 4. El sistema busca la versión por ID y proyecto. 5. El sistema elimina la versión. 6. El sistema responde HTTP 204. |
| postcondicion | La versión desaparece del historial; el esquema actual del proyecto no cambia y no se generan notificaciones |
| excepcion | Si los IDs no son numéricos, HTTP 400; si el usuario no es creador ni EDITOR, HTTP 403; si el proyecto o la versión no existen, HTTP 404; si la cookie no es válida, HTTP 401. Se permite eliminar la última versión |

---

## CU34 — Consultar usuarios para asignar colaborador

| Campo | Detalle |
|-------|---------|
| Id | CU34 |
| nombre | Consultar usuarios para asignar colaborador |
| proposito | Permitir al creador de un proyecto localizar usuarios y obtener su `usuarioId` antes de asignarlos como colaboradores |
| actor | A2 Usuario |
| actor iniciador | A2 Usuario |
| precondicion | El usuario posee una sesión activa |
| flujo principal | 1. El usuario solicita `GET /usuarios` con paginación o `GET /usuarios/username/:username`. 2. El sistema autentica la solicitud. 3. El sistema consulta los usuarios con su persona asociada, sin exponer contraseña ni token FCM. 4. El sistema responde con el listado paginado o con el usuario encontrado. |
| postcondicion | El creador conoce el `usuarioId` del usuario que desea asignar y puede usar CU12 |
| excepcion | Si la paginación es inválida, HTTP 400; si el username no existe, HTTP 404; si la cookie no es válida, HTTP 401 |

---

## Trazabilidad caso de uso → implementación

| Caso de uso | Servicio / controlador | Entidad / tabla |
|---|---|---|
| CU23, CU24 | `AuthService`, `UsuariosService`, `UsuariosController` | `usuario.token_firebase` |
| CU25, CU26, CU27 | `NotificacionesService`, `NotificacionesController` | `notificacion` |
| CU28 | `NotificacionesService`, `FirebaseAdminService`, `ProyectosService`, `ColaboracionService` | `notificacion`, `usuario.token_firebase` |
| CU29, CU30, CU31, CU32, CU33 | `VersionesService`, `ProyectosService`, `ProyectosController` | `version_proyecto` |
| CU34 | `UsuariosService`, `UsuariosController` | `usuario`, `persona` |
