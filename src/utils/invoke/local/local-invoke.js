'use strict'

const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')

const uuidGen = require('uuid/v4')

const { red, green } = require('colors')
const { eventPriority } = require('../../install/file')

const SUPPORT_RUNTIMES = ['nodejs6', 'nodejs8', 'nodejs10', 'nodejs12']

const invocationError = (message, extra) => {
  const error = new Error(message)
  error.name = 'HandledInvocationError'
  if (extra) {
    error.extra = extra
  }
  return error
}

const CALL_BACK = (error, data) => {
  console.log(`${green('FC Invoke Result:\n')}`, data)
  if (error) {
    throw invocationError(error.message)
  }
  if (_.isBuffer(data)) {
    return data
  }
  if (_.isObject(data)) {
    return JSON.stringify(data)
  }
  return data
}

class LocalInvoke {
  constructor (credentials, region, serviceProp = {}, functionProp = {}, options = {}) {
    this.credentials = credentials
    this.accountId = credentials.AccountID

    this.region = region

    this.eventOptions = {
      event: options.e || options.event || '',
      eventFile: options.f || options.eventFile,
      eventStdin: options.s || options.eventStdin
    }

    this.serviceProp = serviceProp
    this.functionProp = functionProp
    this.handler = functionProp.Handler
    this.codeUri = functionProp.CodeUri
    this.runtime = functionProp.Runtime
  }

  getEntryFilePath () {
    const [fileNamePrefix, methodName] = _.split(this.handler, '.')
    const absCodeUri = path.resolve(process.cwd(), this.codeUri)

    let entryFilePath

    const lstat = fs.statSync(absCodeUri)
    if (lstat.isFile()) {
      entryFilePath = absCodeUri
    } else {
      entryFilePath = path.join(absCodeUri, `${fileNamePrefix}.js`)
    }

    return {
      methodName,
      entryFilePath
    }
  }

  mapAndCameCaseKeys (obj) {
    return _.mapKeys(obj, (value, key) => {
      return _.camelCase(key)
    })
  }

  // todo: process Nas,Log... config
  buildInvokeContext () {
    return {
      requestId: uuidGen(),
      credentials: this.mapAndCameCaseKeys(this.credentials),
      service: this.mapAndCameCaseKeys(this.serviceProp),
      function: this.mapAndCameCaseKeys(this.functionProp),
      region: this.region,
      accountId: this.accountId
    }
  }

  asyncFunction (func) {
    return func.constructor.name === 'AsyncFunction'
  }

  async excuteFunction (func, ...restArgs) {
    if (this.asyncFunction(func)) {
      await func(...restArgs)
    } else {
      func(...restArgs)
    }
  }

  async invoke () {
    if (!_.includes(SUPPORT_RUNTIMES, this.runtime)) {
      console.log(red(`runtime: ${this.runtime} is not supported yet.`))
      return
    }

    const { entryFilePath, methodName } = this.getEntryFilePath()

    const hanlder = require(entryFilePath)

    const initializer = hanlder.initializer
    const invokefunction = hanlder[methodName]

    const event = await eventPriority(this.eventOptions)

    const context = this.buildInvokeContext()

    if (initializer) {
      await this.excuteFunction(initializer, context, CALL_BACK)
    }
    await this.excuteFunction(invokefunction, event, context, CALL_BACK)
  }
}

module.exports = LocalInvoke
