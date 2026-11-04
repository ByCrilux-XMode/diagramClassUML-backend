# Endpoints para la app Flutter

Documentación de todos los endpoints del backend, pensada para la app móvil: iniciar sesión, recibir notificaciones, ver proyectos, gestionar colaboradores, crear y eliminar proyectos.

## 1. Convenciones generales

- **URL base local:** `http://localhost:3000`
- **No hay prefijo global** (`/api`, `/v1`, etc.). Las rutas son las que aparecen en este documento.
- **Formato:** JSON (`Content-Type: application/json`).
- **Autenticación:** cookie `tokenAcceso` (JWT, `HttpOnly`). Se crea al iniciar sesión o registrarse y se envía automáticamente en las peticiones posteriores.
- **En Flutter**, como la cookie es `HttpOnly`, hay que usar un manejador de cookies (`dio_cookie_manager` + `cookie_jar`, o guardar el `Set-Cookie` y enviar la cabecera `Cookie`). `withCredentials: true` solo aplica a Flutter Web; en Android/iOS hay que persistir la cookie.
- **Validación estricta:** el backend rechaza campos no declarados en el body (`400`). Enviar exactamente los nombres indicados.
- **Paginación:** query `pagina` (entero ≥ 1, por defecto `1`) y `limite` (entero 1–100, por defecto `10`).
- **IDs:** todos son enteros positivos en la ruta.

### Códigos de error habituales

| Código | Significado |
|---|---|
| `400` | Body o query inválidos, campo desconocido o ID no numérico. |
| `401` | No hay cookie, la cookie expiró o el JWT es inválido. |
| `403` | El usuario no tiene permiso para esa acción. |
| `404` | Recurso no encontrado. |
| `409` | Conflicto (por ejemplo, permiso en uso o username repetido). |

---

## 2. Flujo recomendado en el celular

1. **Login:** `POST /auth/iniciar-sesion` enviando también el token FCM.
2. **Pantalla principal:** `GET /usuarios/me/proyectos` para ver solo los proyectos del usuario.
3. **Detalle de proyecto:** `GET /proyectos/:id`.
4. **Colaboradores:** `GET /proyectos/:id/colaboradores`.
5. **Notificaciones:** `GET /notificaciones` y marcar como leídas.
6. **Crear proyecto:** `POST /proyectos`.
7. **Eliminar proyecto:** `DELETE /proyectos/:id` (solo el creador).
8. **Cerrar sesión:** `DELETE /usuarios/me/token-firebase` y luego `POST /auth/cerrar-sesion`.

---

## 3. Modelos de respuesta

Estos son los campos que devuelve el backend. Las relaciones solo aparecen cuando el endpoint las carga; si no aparecen en un ejemplo, no vienen en esa respuesta.

### Usuario

```json
{
  "usuarioId": 1,
  "username": "user1",
  "personaId": 1,
  "persona": {
    "personaId": 1,
    "nombre": "Juan",
    "apellido": "Pérez"
  }
}
```

> `contrasena` y `tokenFirebase` nunca se devuelven.

### Proyecto

```json
{
  "proyectoId": 5,
  "nombre": "Diagrama UML",
  "esquemaJson": { "nodos": [], "aristas": [] },
  "creadorId": 1,
  "creador": {
    "usuarioId": 1,
    "username": "user1",
    "personaId": 1,
    "persona": { "personaId": 1, "nombre": "Juan", "apellido": "Pérez" }
  }
}
```

> En `GET /proyectos` y `GET /proyectos/:id`, `creador` viene **sin** `persona`.

### Colaborador

```json
{
  "usuarioId": 2,
  "proyectoId": 5,
  "permisoId": 2,
  "usuario": {
    "usuarioId": 2,
    "username": "user2",
    "personaId": 2,
    "persona": { "personaId": 2, "nombre": "María", "apellido": "García" }
  },
  "permiso": { "permisoId": 2, "nombre": "EDITOR" }
}
```

### Permiso

```json
{ "permisoId": 1, "nombre": "LECTOR" }
```

Permisos iniciales creados por el backend:

| `permisoId` | `nombre` | Puede |
|---|---|---|
| `1` | `LECTOR` | Ver el proyecto y colaborar en tiempo real (sin guardar cambios). |
| `2` | `EDITOR` | Ver, editar el esquema, guardar, crear, restaurar y eliminar versiones. |

### Versión de proyecto

```json
{
  "versionId": 12,
  "nombre": "Versión 3",
  "descripcion": "Guardado automático realizado por Juan Pérez.",
  "esquemaJson": { "nodos": [], "aristas": [] },
  "creadaEn": "2026-11-02T19:00:00.000Z",
  "proyectoId": 5,
  "creadoPorId": 1,
  "creadoPor": {
    "usuarioId": 1,
    "username": "user1",
    "persona": { "personaId": 1, "nombre": "Juan", "apellido": "Pérez" }
  }
}
```

### Notificación

```json
{
  "notificacionId": 30,
  "tipoAccion": "PROYECTO_GUARDADO",
  "titulo": "Proyecto guardado",
  "mensaje": "María García guardó el proyecto \"Diagrama UML\".",
  "datos": {
    "tipoAccion": "PROYECTO_GUARDADO",
    "proyectoId": "5",
    "nombreProyecto": "Diagrama UML",
    "actorId": "2",
    "actorUsername": "user2",
    "actorNombre": "María García"
  },
  "leida": false,
  "enviada": true,
  "creadaEn": "2026-11-02T19:00:00.000Z",
  "destinatarioId": 1,
  "actorId": 2,
  "proyectoId": 5,
  "actor": {
    "usuarioId": 2,
    "username": "user2",
    "persona": { "personaId": 2, "nombre": "María", "apellido": "García" }
  }
}
```

---

## 4. Autenticación

### `POST /auth/registrarse`

Crea el usuario, inicia sesión y devuelve la cookie `tokenAcceso`.

**Body:**

```json
{
  "username": "luis",
  "password": "clave1234",
  "nombre": "Luis",
  "apellido": "García",
  "tokenFirebase": "opcional-token-fcm"
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `username` | string | Sí | No vacío, máx. 50, único. |
| `password` | string | Sí | 8–72 caracteres. |
| `nombre` | string | Sí | No vacío, máx. 100. |
| `apellido` | string | Sí | No vacío, máx. 100. |
| `tokenFirebase` | string | No | No vacío, máx. 512. |

**Respuesta `201`:**

```json
{
  "usuario": {
    "usuarioId": 4,
    "username": "luis",
    "personaId": 4,
    "persona": { "personaId": 4, "nombre": "Luis", "apellido": "García" }
  }
}
```

**Errores:** `400` validación, `409` username repetido.

---

### `POST /auth/iniciar-sesion`

**Body:**

```json
{
  "username": "user1",
  "password": "user123",
  "tokenFirebase": "opcional-token-fcm"
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `username` | string | Sí | No vacío. |
| `password` | string | Sí | No vacío. |
| `tokenFirebase` | string | No | No vacío, máx. 512. Se guarda en el usuario en la misma petición. |

**Respuesta `200`:**

```json
{
  "usuario": {
    "usuarioId": 1,
    "username": "user1",
    "personaId": 1,
    "persona": { "personaId": 1, "nombre": "Juan", "apellido": "Pérez" }
  }
}
```

Además devuelve `Set-Cookie: tokenAcceso=...; HttpOnly; Path=/; SameSite=Lax`.

**Errores:** `400` validación, `401` credenciales inválidas.

---

### `POST /auth/cerrar-sesion`

No recibe body.

**Respuesta `204`:** sin contenido. Borra la cookie `tokenAcceso`.

> Recomendado en Flutter: antes de cerrar sesión, llamar a `DELETE /usuarios/me/token-firebase` para no seguir recibiendo push en ese dispositivo.

---

## 5. Usuarios

### `GET /usuarios`

Lista todos los usuarios (útil para buscar a quién asignar como colaborador).

**Query:** `pagina`, `limite`.

**Respuesta `200`:**

```json
{
  "datos": [
    {
      "usuarioId": 1,
      "username": "user1",
      "personaId": 1,
      "persona": { "personaId": 1, "nombre": "Juan", "apellido": "Pérez" }
    }
  ],
  "total": 3
}
```

---

### `GET /usuarios/me`

Devuelve el perfil del usuario autenticado.

**Respuesta `200`:** objeto `Usuario`.

**Errores:** `401` sin cookie válida.

---

### `GET /usuarios/me/proyectos`

Devuelve **solo los proyectos del usuario**: los que creó y aquellos donde es colaborador.

**Query:** `pagina`, `limite`.

**Respuesta `200`:**

```json
{
  "datos": [
    { "proyectoId": 5, "nombre": "Diagrama UML", "rol": "CREADOR" },
    { "proyectoId": 8, "nombre": "Base de datos", "rol": "EDITOR" }
  ],
  "total": 2
}
```

`rol` puede ser `CREADOR`, `EDITOR` o `LECTOR`.

> Para la pantalla "Mis proyectos" del celular, este es el endpoint correcto. `GET /proyectos` devuelve todos los proyectos del sistema.

---

### `PUT /usuarios/me/token-firebase`

Registra o actualiza el token FCM del dispositivo actual. Se usa cuando Firebase renueva el token (`onTokenRefresh`) o si no se envió durante el login.

**Body:**

```json
{ "tokenFirebase": "fcm-token-del-dispositivo" }
```

**Respuesta `204`:** sin contenido.

**Errores:** `400` token vacío o mayor a 512, `401`.

---

### `DELETE /usuarios/me/token-firebase`

Elimina el token FCM del usuario (por ejemplo, al cerrar sesión).

**Respuesta `204`:** sin contenido.

---

### `GET /usuarios/username/:username`

Busca un usuario por su `username`. Útil para obtener el `usuarioId` antes de asignarlo como colaborador.

**Respuesta `200`:** objeto `Usuario`.

**Errores:** `404` si no existe.

---

### `GET /usuarios/:id`

Busca un usuario por ID.

**Respuesta `200`:** objeto `Usuario`.

**Errores:** `400` ID inválido, `404` si no existe.

---

## 6. Proyectos

### `POST /proyectos`

Crea un proyecto. El usuario autenticado queda como creador.

**Body:**

```json
{
  "nombre": "Diagrama UML",
  "esquemaJson": { "nodos": [], "aristas": [] }
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `nombre` | string | Sí | No vacío, máx. 100. |
| `esquemaJson` | objeto JSON | No | Esquema inicial. |

**Respuesta `201`:** objeto `Proyecto` (con `creador`).

**Errores:** `400` validación, `401`.

---

### `GET /proyectos`

Lista **todos** los proyectos del sistema, no solo los del usuario. Para "Mis proyectos" usar `GET /usuarios/me/proyectos`.

**Query:** `pagina`, `limite`.

**Respuesta `200`:**

```json
{
  "datos": [
    {
      "proyectoId": 5,
      "nombre": "Diagrama UML",
      "esquemaJson": { "nodos": [], "aristas": [] },
      "creadorId": 1,
      "creador": { "usuarioId": 1, "username": "user1" }
    }
  ],
  "total": 10
}
```

---

### `GET /proyectos/:id`

Obtiene un proyecto con su esquema actual.

**Respuesta `200`:** objeto `Proyecto` (con `creador`, sin `persona`).

**Errores:** `400` ID inválido, `404` no encontrado.

---

### `PATCH /proyectos/:id`

Actualiza el nombre y/o el esquema. Requiere ser **creador** o tener permiso **EDITOR**.

**Body (al menos un campo):**

```json
{
  "nombre": "Diagrama UML v2",
  "esquemaJson": { "nodos": [], "aristas": [] }
}
```

**Respuesta `200`:** objeto `Proyecto` actualizado.

> Si se envía `esquemaJson`, el backend crea automáticamente una versión nueva y notifica a los demás miembros del proyecto.

**Errores:** `400`, `401`, `403` sin permiso de escritura, `404`.

---

### `DELETE /proyectos/:id`

Elimina el proyecto. **Solo el creador** puede hacerlo. También se eliminan sus colaboradores, versiones y notificaciones asociadas.

**Respuesta `204`:** sin contenido.

**Errores:** `401`, `403` si no es el creador, `404`.

---

### `POST /proyectos/:id/guardar-colaboracion`

Guarda en PostgreSQL el estado actual del documento colaborativo (Yjs). Requiere ser **creador** o **EDITOR**. No recibe body.

**Respuesta `200`:** objeto `Proyecto` actualizado.

> Si existe un documento colaborativo vivo o un esquema temporal, se crea una versión automática y se notifica a los demás miembros. No se compara el contenido: puede notificar aunque no haya ediciones nuevas.

**Errores:** `401`, `403`, `404`.

---

### `GET /proyectos/:id/versiones`

Lista las versiones del proyecto, de la más reciente a la más antigua.

**Query:** `pagina`, `limite`.

**Respuesta `200`:**

```json
{
  "datos": [
    {
      "versionId": 12,
      "nombre": "Versión 3",
      "descripcion": "Guardado automático realizado por Juan Pérez.",
      "esquemaJson": { "nodos": [], "aristas": [] },
      "creadaEn": "2026-11-02T19:00:00.000Z",
      "proyectoId": 5,
      "creadoPorId": 1,
      "creadoPor": {
        "usuarioId": 1,
        "username": "user1",
        "persona": { "personaId": 1, "nombre": "Juan", "apellido": "Pérez" }
      }
    }
  ],
  "total": 12
}
```

**Errores:** `400`. Si el proyecto no existe, devuelve `{ "datos": [], "total": 0 }`.

---

### `GET /proyectos/:id/versiones/:versionId`

Obtiene una versión concreta con su esquema completo.

**Respuesta `200`:** objeto `Versión de proyecto`.

**Errores:** `400`, `404` si la versión no pertenece al proyecto o no existe.

---

### `POST /proyectos/:id/versiones`

Crea una versión manual con el esquema actual del proyecto. Requiere ser **creador** o **EDITOR**.

**Body (opcional):**

```json
{
  "nombre": "Entrega parcial",
  "descripcion": "Versión antes de la revisión."
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `nombre` | string | No | Máx. 150. Si se omite: `Versión N`. |
| `descripcion` | string | No | Máx. 1000. |

**Respuesta `201`:** objeto `Versión de proyecto`.

**Errores:** `400`, `401`, `403`, `404`.

---

### `POST /proyectos/:id/versiones/:versionId/restaurar`

Restaura el esquema de una versión. Requiere ser **creador** o **EDITOR**. No recibe body.

**Respuesta `200`:** objeto `Proyecto` con el esquema restaurado.

> Además de restaurar, crea una versión nueva llamada `Restauración de <nombre>` y notifica a los demás miembros.

**Errores:** `400`, `401`, `403`, `404`.

---

### `DELETE /proyectos/:id/versiones/:versionId`

Elimina una versión concreta. Requiere ser **creador** o **EDITOR**. No recibe body.

**Respuesta `204`:** sin contenido.

> No modifica el esquema actual del proyecto ni genera notificaciones. El proyecto sigue existiendo aunque se elimine la última versión.

**Errores:** `400`, `401`, `403`, `404`.

---

## 7. Colaboradores

> **Importante:** listar, asignar, cambiar permisos y remover colaboradores está permitido **solo al creador del proyecto**. Un `EDITOR` no puede gestionar colaboradores.

### `GET /proyectos/:proyectoId/colaboradores`

Lista los colaboradores del proyecto.

**Respuesta `200`:** arreglo de `Colaborador`:

```json
[
  {
    "usuarioId": 2,
    "proyectoId": 5,
    "permisoId": 2,
    "usuario": {
      "usuarioId": 2,
      "username": "user2",
      "persona": { "personaId": 2, "nombre": "María", "apellido": "García" }
    },
    "permiso": { "permisoId": 2, "nombre": "EDITOR" }
  }
]
```

**Errores:** `401`, `403` si no es el creador, `404`.

> El creador no aparece en esta lista; ya viene en `proyecto.creador`. Si quieres mostrar "todos los miembros", combina el creador con esta lista.

---

### `POST /proyectos/:proyectoId/colaboradores`

Asigna un usuario como colaborador. Si ya existe, actualiza su permiso.

**Body:**

```json
{
  "usuarioId": 2,
  "permisoId": 2
}
```

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `usuarioId` | entero positivo | Sí | Usuario a asignar. |
| `permisoId` | entero positivo | Sí | `1` = LECTOR, `2` = EDITOR. |

**Respuesta `201`:** objeto `Colaborador` (con `usuario.persona` y `permiso`).

**Errores:** `400`, `401`, `403` si no es el creador, `404` si el usuario o el permiso no existen.

---

### `PATCH /proyectos/:proyectoId/colaboradores/:usuarioId`

Cambia el permiso de un colaborador.

**Body:**

```json
{ "permisoId": 1 }
```

**Respuesta `200`:** objeto `Colaborador` actualizado.

**Errores:** `400`, `401`, `403`, `404`.

---

### `DELETE /proyectos/:proyectoId/colaboradores/:usuarioId`

Remueve a un colaborador del proyecto.

**Respuesta `204`:** sin contenido.

**Errores:** `400`, `401`, `403`, `404`.

---

## 8. Permisos

### `GET /permisos`

Lista los permisos disponibles. Útil para mostrar las opciones LECTOR/EDITOR al asignar un colaborador.

**Respuesta `200`:**

```json
[
  { "permisoId": 1, "nombre": "LECTOR" },
  { "permisoId": 2, "nombre": "EDITOR" }
]
```

---

### `POST /permisos`

Crea un permiso nuevo. No hay rol de administrador: cualquier usuario autenticado puede llamarlo.

**Body:**

```json
{ "nombre": "COMENTARISTA" }
```

**Respuesta `201`:** objeto `Permiso`.

**Errores:** `400` validación, `401`.

---

### `DELETE /permisos/:id`

Elimina un permiso.

**Respuesta `204`:** sin contenido.

**Errores:** `400`, `401`, `404`, `409` si el permiso está asignado a algún colaborador.

---

## 9. Notificaciones

### `GET /notificaciones`

Historial de notificaciones del usuario autenticado, de la más reciente a la más antigua.

**Query:** `pagina`, `limite`.

**Respuesta `200`:**

```json
{
  "datos": [
    {
      "notificacionId": 30,
      "tipoAccion": "VERSION_RESTAURADA",
      "titulo": "Versión restaurada",
      "mensaje": "María García restauró la versión \"Versión 2\" del proyecto \"Diagrama UML\".",
      "datos": {
        "tipoAccion": "VERSION_RESTAURADA",
        "proyectoId": "5",
        "nombreProyecto": "Diagrama UML",
        "actorId": "2",
        "actorUsername": "user2",
        "actorNombre": "María García",
        "versionId": "10",
        "nombreVersion": "Versión 2"
      },
      "leida": false,
      "enviada": true,
      "creadaEn": "2026-11-02T19:00:00.000Z",
      "destinatarioId": 1,
      "actorId": 2,
      "proyectoId": 5,
      "actor": {
        "usuarioId": 2,
        "username": "user2",
        "persona": { "personaId": 2, "nombre": "María", "apellido": "García" }
      }
    }
  ],
  "total": 1,
  "noLeidas": 1
}
```

**Errores:** `400` query inválida, `401`.

> El campo `datos` es el mismo que viaja en el push FCM y sirve para navegar al proyecto al tocar la notificación.

---

### `PATCH /notificaciones/:id/leida`

Marca una notificación como leída. Solo funciona con notificaciones del usuario autenticado.

**Respuesta `200`:** objeto `Notificacion` actualizado.

**Errores:** `400`, `401`, `404`.

---

### `PATCH /notificaciones/leidas`

Marca **todas** las notificaciones del usuario como leídas. No recibe body.

**Respuesta `204`:** sin contenido.

**Errores:** `401`.

---

## 10. Salud del backend

### `GET /`

Endpoint público para comprobar que el servidor está arriba.

**Respuesta `200`:**

```text
Hello World!
```

---

## 11. Resumen por pantalla en Flutter

| Pantalla | Endpoint(s) |
|---|---|
| Login | `POST /auth/iniciar-sesion` (con `tokenFirebase`) |
| Registro | `POST /auth/registrarse` |
| Mis proyectos | `GET /usuarios/me/proyectos` |
| Detalle de proyecto | `GET /proyectos/:id` |
| Colaboradores del proyecto | `GET /proyectos/:id/colaboradores` |
| Buscar usuario para asignar | `GET /usuarios?pagina=1&limite=10` o `GET /usuarios/username/:username` |
| Asignar colaborador | `POST /proyectos/:id/colaboradores` |
| Cambiar permiso | `PATCH /proyectos/:id/colaboradores/:usuarioId` |
| Quitar colaborador | `DELETE /proyectos/:id/colaboradores/:usuarioId` |
| Crear proyecto | `POST /proyectos` |
| Editar / guardar esquema | `PATCH /proyectos/:id` o `POST /proyectos/:id/guardar-colaboracion` |
| Eliminar proyecto | `DELETE /proyectos/:id` |
| Historial de versiones | `GET /proyectos/:id/versiones` |
| Restaurar versión | `POST /proyectos/:id/versiones/:versionId/restaurar` |
| Eliminar versión | `DELETE /proyectos/:id/versiones/:versionId` |
| Notificaciones | `GET /notificaciones` |
| Marcar todas como leídas | `PATCH /notificaciones/leidas` |
| Cerrar sesión | `DELETE /usuarios/me/token-firebase` + `POST /auth/cerrar-sesion` |

---

## 12. Notificaciones push (FCM) en el celular

El backend envía el push a todos los miembros del proyecto **excepto al usuario que realizó la acción**. Para recibirlo:

1. En Flutter, obtener el token con `FirebaseMessaging.instance.getToken()`.
2. Enviarlo en `POST /auth/iniciar-sesion` como `tokenFirebase`, o después con `PUT /usuarios/me/token-firebase`.
3. Escuchar renovaciones con `FirebaseMessaging.instance.onTokenRefresh` y actualizar con `PUT /usuarios/me/token-firebase`.
4. Al tocar la notificación, usar `message.data['proyectoId']` para abrir el proyecto. El payload incluye:

```json
{
  "tipoAccion": "PROYECTO_GUARDADO",
  "proyectoId": "5",
  "nombreProyecto": "Diagrama UML",
  "actorId": "2",
  "actorUsername": "user2",
  "actorNombre": "María García"
}
```

En restauraciones también incluye `versionId` y `nombreVersion`.

> La app solo puede **recibir** push si el backend tiene configuradas las credenciales de Firebase Admin (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` o `GOOGLE_APPLICATION_CREDENTIALS`). Sin ellas, el backend guarda la notificación en la base de datos pero no envía el push.
