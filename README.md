<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development (watch mode)
$ npm run start:dev

# compile once
$ npm run build

# production mode (runs the compiled output)
$ npm start
# or
$ npm run start:prod
```

## Notificaciones push (Firebase)

La configuración de Firebase Admin, el registro del token FCM desde Flutter, las versiones de proyecto y los endpoints de notificaciones están documentados en [docs/notificaciones-firebase.md](docs/notificaciones-firebase.md).

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Operación del sistema

### Cookie de sesión compartida

El proxy de Next valida la sesión contra `GET /usuarios/me` con la cookie
`tokenAcceso`. Para que el navegador envíe esa cookie al host del frontend, la
cookie se emite con `COOKIE_DOMAIN` cuando la variable está definida.

| Escenario | Configuración | Resultado |
|---|---|---|
| Mismo host, distinto puerto (desarrollo) | sin `COOKIE_DOMAIN` | funciona: las cookies no se aíslan por puerto |
| Subdominios (`app.x.com` + `api.x.com`) | `COOKIE_DOMAIN=.x.com` | funciona |
| Dominios distintos (`app.com` + `api.io`) | no soportado | el proxy devuelve 503 con mensaje de configuración |

`COOKIE_DOMAIN` solo añade `domain`; la cookie conserva `httpOnly`, `path: '/'` y
`secure`/`sameSite` según `COOKIE_SECURE`. Nunca se expone el token a JavaScript.

### Límites de uso

| Variable | Defecto | Alcance |
|---|---|---|
| `IA_LIMITE_TURNOS_MINUTO` | `10` | Turnos de IA por usuario y proyecto; `0` desactiva solo la frecuencia. |
| `IA_LIMITE_CHAT_MINUTO` | `20` | Peticiones al proxy `/api/ia/*` por usuario. |
| `IA_LIMITE_CHAT_HORA` | `200` | Peticiones al proxy `/api/ia/*` por usuario. |

El límite de turnos se evalúa antes de validar el permiso y de crear el turno:
un `429` no deja ningún turno huérfano ni altera el índice único parcial.

### Operación de MongoDB

La bitácora no tiene TTL y Atlas M0 tiene 512 MB, así que la medición es un
script con salida JSON y código de salida, nunca un endpoint HTTP.

```bash
# Uso por colección, porcentaje y umbral. Sale con código 1 al superar el umbral.
npm run mongo:estado

# Exporta cada colección a export/<coleccion>-<fecha>.jsonl.gz con cursor + gzip.
npm run mongo:exportar
```

| Variable | Defecto | Uso |
|---|---|---|
| `MONGO_CAPACIDAD_MB` | `512` | Capacidad usada para calcular el porcentaje. |
| `MONGO_UMBRAL_MB` | `70` | Porcentaje a partir del cual `mongo:estado` sale con código 1. |
| `MONGO_EXPORT_DIR` | `export` | Directorio de salida de `mongo:exportar`. |

`mongo:estado` informa `capacidadMb`, `usadoMb`, `porcentaje`, `mayorColeccion` y
el tamaño de `eventos`, `salas`, `mensajes`, `propuestas`, `planes`, `turnos_ia`
y `config_ia`. La exportación escribe línea por línea respetando la
contrapresión del stream: no carga la colección completa en memoria.

### Reversión del último turno de IA

`GET /proyectos/:id/eventos/ultimo-turno-ia` devuelve el último `turnoId` de la
IA, sus eventos y `deshacible`. Solo CREADOR y EDITOR pueden consultarlo; un
LECTOR o un ajeno recibe 403. El lote se rechaza si una entidad cambió después
del turno o si algún cambio no guardó `antes`. El cliente reconstruye las tools
inversas, las aplica con aprobación humana y registra un turno nuevo con
`revierteTurnoId`; el campo es opcional y `null` en los eventos anteriores.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
"# diagramClassUML-backend" 
