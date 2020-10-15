'use strict'

const _ = require('lodash')

const kitx = require('kitx')
const Client = require('../../fc/client')

const { eventPriority } = require('../../install/file')
const { green, yellow, red } = require('colors')
const { composeStringToSign, signString } = require('../../fc/signature')

const INVOKE_TYPE = ['async', 'sync']

class RemoteInvoke extends Client {
  constructor (credentials, region, serviceName, functionName, options) {
    super(credentials, region)

    this.serviceName = serviceName
    this.functionName = functionName

    this.qualifier = options.q || options.qualifier || 'LATEST'
    this.invocationType = options.t || options.invocationType || 'sync'

    this.eventOptions = {
      event: options.e || options.event || '',
      eventFile: options.f || options.eventFile,
      eventStdin: options.s || options.eventStdin
    }

    this.fcClient = this.buildFcClient()
  }

  async getTriggerMetas (serviceName, functionName) {
    const { data } = await this.fcClient.listTriggers(serviceName, functionName)
    return data.triggers
  }

  async getHttpTrigger (serviceName, functionName) {
    const triggers = await this.getTriggerMetas(serviceName, functionName)
    if (_.isEmpty(triggers)) { return [] }

    const httpTrigger = triggers.filter(t => t.triggerType === 'http' || t.triggerType === 'https')
    if (_.isEmpty(httpTrigger)) { return [] }

    return httpTrigger
  }

  /**
   * @param event: { body, headers, method, queries, path }
   * path 组装后的路径 /proxy/serviceName/functionName/path ,
   */
  async request (event) {
    const { headers, queries, method, path: p, body } = this.handlerHttpParmase(event)

    let resp
    try {
      if (method.toLocaleUpperCase() === 'GET') {
        resp = await this.fcClient.get(p, queries, headers)
      } else if (method.toLocaleUpperCase() === 'POST') {
        resp = await this.fcClient.post(p, body, headers, queries)
      } else if (method.toLocaleUpperCase() === 'PUT') {
        resp = await this.fcClient.put(p, body, headers)
      } else if (method.toLocaleUpperCase() === 'DELETE') {
        resp = await this.fcClient.request('DELETE', p, queries, null, headers)
        /* else if (method.toLocaleUpperCase() === 'PATCH') {
        resp = await this.fcClient.request('PATCH', p, queries, body, headers);
      } else if (method.toLocaleUpperCase() === 'HEAD') {
        resp = await this.fcClient.request('HEAD', p, queries, body, headers);
      } */
      } else {
        console.log(`Does not support ${method} requests temporarily.`)
      }
    } catch (e) {
      console.log(e)
      throw e
    }

    if (resp) {
      const log = resp.headers['x-fc-log-result']
      if (log) {
        this.handlerLog(log)
      }
      console.log(`FC Invoke Result:\n${resp.data}`)
    }
  }

  handlerHttpParmase (event) {
    const { body = '', headers = {}, method = 'GET', queries = '', path: p = '' } = event

    let postBody
    if (body) {
      let buff = null
      if (Buffer.isBuffer(body)) {
        buff = body
        headers['content-type'] = 'application/octet-stream'
      } else if (typeof body === 'string') {
        buff = Buffer.from(body, 'utf8')
        headers['content-type'] = 'application/octet-stream'
      } else if (typeof body.pipe === 'function') {
        buff = body
        headers['content-type'] = 'application/octet-stream'
      } else {
        buff = Buffer.from(JSON.stringify(body), 'utf8')
        headers['content-type'] = 'application/json'
      }

      if (typeof body.pipe !== 'function') {
        const digest = kitx.md5(buff, 'hex')
        const md5 = Buffer.from(digest, 'utf8').toString('base64')

        headers['content-length'] = buff.length
        headers['content-md5'] = md5
      }
      postBody = buff
    }

    if (!headers['X-Fc-Log-Type']) {
      headers['X-Fc-Log-Type'] = 'Tail'
    }
    headers.date = new Date().toUTCString()

    const source = composeStringToSign(method, p, headers, queries)
    const signature = signString(source, this.accessKeySecret)
    headers.Authorization = 'FC ' + this.accessKeyID + ':' + signature
    return {
      headers,
      queries,
      method,
      path: p,
      body: postBody
    }
  }

  handlerLog (log) {
    console.log('\n========= FC invoke Logs begin =========')
    const decodedLog = Buffer.from(log, 'base64')
    console.log(decodedLog.toString())
    console.log('========= FC invoke Logs end =========\n')
  }

  async httpInvoke ({ serviceName, functionName, event, qualifier }) {
    const q = qualifier ? `.${qualifier}` : ''
    const p = `/proxy/${serviceName}${q}/${functionName}/${event.path || ''}`

    console.log(`https://${this.accountId}.${this.region}.fc.aliyuncs.com/2016-08-15/proxy/${serviceName}${q}/${functionName}/`)

    await this.request({ ...event, path: p })
  }

  async eventInvoke ({
    serviceName,
    functionName,
    event,
    qualifier = 'LATEST',
    invocationType
  }) {
    let rs

    if (invocationType === 'Sync') {
      rs = await this.fcClient.invokeFunction(serviceName, functionName, event, {
        'X-Fc-Log-Type': 'Tail',
        'X-Fc-Invocation-Type': invocationType
      }, qualifier)

      const log = rs.headers['x-fc-log-result']

      if (log) {
        console.log(yellow('========= FC invoke Logs begin ========='))
        const decodedLog = Buffer.from(log, 'base64')
        console.log(decodedLog.toString())
        console.log(yellow('========= FC invoke Logs end ========='))

        console.log(green('\nFC Invoke Result:'))
        console.log(rs.data)
      }
    } else {
      rs = await this.fcClient.invokeFunction(serviceName, functionName, event, {
        'X-Fc-Invocation-Type': invocationType
      }, qualifier)

      console.log(green('✔ ') + `${serviceName}/${functionName} async invoke success.\n`)
    }
    return rs
  }

  async invoke () {
    const upperCase = _.lowerCase(this.invocationType)

    if (!_.includes(INVOKE_TYPE, upperCase)) {
      throw new Error(red(`error: unexpected argument：${this.invocationType}`))
    }

    const event = await eventPriority(this.eventOptions)

    const httpTriggers = await this.getHttpTrigger(this.serviceName, this.functionName)

    if (_.isEmpty(httpTriggers)) {
      await this.eventInvoke({
        event,
        serviceName: this.serviceName,
        functionName: this.functionName,
        qualifier: this.qualifier,
        invocationType: _.upperFirst(upperCase)
      })
    } else {
      await this.httpInvoke({
        event,
        serviceName: this.serviceName,
        functionName: this.functionName,
        qualifier: this.qualifier
      })
    }
  }
}

module.exports = RemoteInvoke
