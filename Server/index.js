require('dotenv').config({silent: true})
const log = new (require('./logger'))('index')

const http = require('http')
const Koa = require('koa')
const app = new Koa()
const _io = require('socket.io')
const router = require('koa-better-router')().loadMethods()
const Roleypoly = require('./Roleypoly')

// Create the server and socket.io server
const server = http.createServer(app.callback())
const io = _io(server, { transports: ['websocket'], path: '/api/socket.io', wsEngine: 'uws' })

const M = new Roleypoly(router, io, app) // eslint-disable-line no-unused-vars

app.keys = [ process.env.APP_KEY ]

const DEVEL = process.env.NODE_ENV === 'development'

async function start () {
  await M.awaitServices()

  // body parser
  const bodyParser = require('koa-bodyparser')
  app.use(bodyParser({ types: ['json'] }))

  // Request logger
  app.use(async (ctx, next) => {
    let timeStart = new Date()
    try {
      await next()
    } catch (e) {
      log.error(e)
      ctx.status = ctx.status || 500
      if (DEVEL) {
        ctx.body = ctx.body || e.stack
      } else {
        ctx.body = {
          err: 'something terrible happened.'
        }
      }
    }
    let timeElapsed = new Date() - timeStart

    log.request(`${ctx.status} ${ctx.method} ${ctx.url} - ${ctx.ip} - took ${timeElapsed}ms`)
    return null
  })

  const session = require('koa-session')
  app.use(session({
    key: 'roleypoly:sess',
    maxAge: 'session',
    store: M.ctx.sessions
  }, app))

  await M.mountRoutes()

  log.info(`starting HTTP server on ${process.env.APP_PORT || 6769}`)
  server.listen(process.env.APP_PORT || 6769)
}

start().catch(e => {
  console.error(e)
})
