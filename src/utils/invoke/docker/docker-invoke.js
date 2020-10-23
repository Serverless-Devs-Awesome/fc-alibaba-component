'use strict'

const _ = require('lodash')

const express = require('express')
const app = express()
const fs = require('fs-extra')
const path = require('path')
const debug = require('debug')('invoke:docker')
const HttpSupport = require('./support/http-support')

const { ensureTmpDir } = require('../../path')
const { detectLibrary } = require('./support/common')
const { eventPriority } = require('../../install/file')
const { getDebugIde, getDebugPort } = require('../../docker/debug')
const { syncFind, isDotnetcoreRuntime, isFalseValue } = require('../../common')

const DEFAULT_NAS_PATH_SUFFIX = path.join('.fun', 'nas')
const DEFAULT_LOCAL_TMP_PATH_SUFFIX = path.join('.fun', 'tmp', 'local')
const DEFAULT_BUILD_ARTIFACTS_PATH_SUFFIX = path.join('.fun', 'build', 'artifacts')

const serverPort = 8000
const SERVER_CLOSE_TIMEOUT = 3000

class DockerInvoke {
  constructor (credentials, region, serviceName, serviceProp, functionName, functionProp, options) {
    this.credentials = credentials
    this.region = region
    this.options = options

    this.serviceName = serviceName
    this.serviceProp = serviceProp
    this.functionName = functionName
    this.functionProp = functionProp
    this.codeUri = this.functionProp.CodeUri
    this.runtime = this.functionProp.Runtime

    this.debugPort = getDebugPort(options)
    this.debugIde = getDebugIde(options)
    this.debuggerPath = options.debuggerPath
    this.debugArgs = options.debugArgs

    this.tplPath = this.detectTplPath()
    this.baseDir = path.dirname(this.tplPath)
    this.nasBaseDir = this.detectNasBaseDir(this.tplPath)

    this.httpTriggers = this.findHttpTrigger(functionProp)
    this.isHttpTrigger = this.httpTriggers.length > 0
  }

  detectNasBaseDir (tplPath) {
    const baseDir = this.getBaseDir(tplPath)
    return path.join(baseDir, DEFAULT_NAS_PATH_SUFFIX)
  }

  getBaseDir (tplPath) {
    const idx = tplPath.indexOf(DEFAULT_BUILD_ARTIFACTS_PATH_SUFFIX)

    if (idx !== -1) {
      const baseDir = tplPath.substring(0, idx)
      if (!baseDir) {
        return process.cwd()
      }
      return baseDir
    }
    return path.resolve(path.dirname(tplPath))
  }

  detectTmpDir (tplPath, tmpDir) {
    if (tmpDir) { return tmpDir }

    const baseDir = this.getBaseDir(tplPath)
    return path.join(baseDir, DEFAULT_LOCAL_TMP_PATH_SUFFIX)
  }

  findHttpTrigger (functionProps) {
    const httpTrigger = []

    const triggers = functionProps.Triggers

    if (_.isEmpty(triggers)) { return httpTrigger }

    for (const trigger of triggers) {
      if (trigger.Type === 'HTTP') {
        httpTrigger.push(trigger)
      }
    }

    return httpTrigger
  }

  detectTplPath () {
    const defaultTemplate = ['template.yml', 'template.yaml', 'faas.yml', 'faas.yaml']
      .map((f) => path.join(process.cwd(), f))

    return syncFind([...defaultTemplate], (path) => {
      return fs.pathExistsSync(path)
    })
  }

  buildEventOptions (options = {}) {
    Object.assign(options, {
      event: options.e || options.event || '',
      eventFile: options.f || options.eventFile,
      eventStdin: options.s || options.eventStdin
    })
  }

  async localInvoke () {
    this.buildEventOptions(this.options)

    const event = await eventPriority(this.options)
    debug('event content: ' + event)

    await detectLibrary(this.codeUri, this.runtime, this.baseDir, this.functionName)

    // env 'DISABLE_BIND_MOUNT_TMP_DIR' to disable bind mount of tmp dir.
    // libreoffice will be failed if /tmp directory is bind mount by docker.
    // dotnetcore runtime local run will be failed if /tmp directory is bind mount by docker in win.
    let absTmpDir
    if (isDotnetcoreRuntime(this.runtime)) {
      if (isFalseValue(process.env.DISABLE_BIND_MOUNT_TMP_DIR)) {
        absTmpDir = await ensureTmpDir(this.options.tmpDir, this.tplPath, this.serviceName, this.functionName)
      }
    } else if (!process.env.DISABLE_BIND_MOUNT_TMP_DIR ||
      isFalseValue(process.env.DISABLE_BIND_MOUNT_TMP_DIR)
    ) {
      absTmpDir = await ensureTmpDir(this.options.tmpDir, this.tplPath, this.serviceName, this.functionName)
    }

    debug(`The temp directory mounted to /tmp is ${absTmpDir || 'null'}`)

    // Lazy loading to avoid stdin being taken over twice.
    const EventInvoke = require('./event-invoke')

    const eventInvoke = new EventInvoke(
      this.serviceName, this.region, this.serviceProp,
      this.functionName, this.functionProp,
      this.debugPort, this.debugIde,
      this.baseDir, absTmpDir,
      this.debuggerPath, this.debugArgs,
      this.options.reuse, this.nasBaseDir
    )
    await eventInvoke.invoke(event)
  }

  registerSigintForExpress (server) {
    var sockets = {}; var nextSocketId = 0

    // close express server
    // https://stackoverflow.com/questions/14626636/how-do-i-shutdown-a-node-js-https-server-immediately/14636625#14636625
    server.on('connection', (socket) => {
      const socketId = nextSocketId++
      sockets[socketId] = socket
      socket.on('close', function () {
        delete sockets[socketId]
      })
    })

    process.once('SIGINT', () => {
      console.log('begin to close server')

      // force close if gracefully closing failed
      // https://stackoverflow.com/a/36830072/6602338
      const serverCloseTimeout = setTimeout(() => {
        console.log('server close timeout, force to close server')

        server.emit('close')

        // if force close failed, exit directly
        setTimeout(() => {
          process.exit(-1); // eslint-disable-line
        }, SERVER_CLOSE_TIMEOUT)
      }, SERVER_CLOSE_TIMEOUT)

      // gracefully close server
      server.close(() => {
        clearTimeout(serverCloseTimeout)
      })

      for (const socketId in sockets) {
        if (!{}.hasOwnProperty.call(sockets, socketId)) { continue }
        sockets[socketId].destroy()
      }
    })
  }

  startExpress (app) {
    const server = app.listen(serverPort, function () {
      console.log(`function compute app listening on port ${serverPort}!`)
      console.log()
    })

    this.registerSigintForExpress(server)
  }

  async localStart () {
    const router = express.Router({
      strict: true
    })

    const httpSupport = new HttpSupport(this.credentials, this.region)
    await httpSupport.registerHttpTriggers(this.serviceName, this.serviceProp, this.functionName, this.functionProp, app, router, serverPort, this.httpTriggers, this.debugPort, this.debugIde, this.baseDir, this.debuggerPath, this.debugArgs, this.nasBaseDir, this.tplPath)

    this.startExpress(app)
  }

  async invoke () {
    if (this.isHttpTrigger) {
      await this.localStart()
    } else {
      await this.localInvoke()
    }
  }
}

module.exports = DockerInvoke
