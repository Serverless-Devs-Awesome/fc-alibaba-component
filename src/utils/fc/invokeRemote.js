'use strict'

const fs = require('fs')
const path = require('path')
const kitx = require('kitx')
const Client = require('./client')

const { composeStringToSign, signString } = require('./signature')

class InvokeRemote extends Client {
  constructor (credentials, region) {
    super(credentials, region)
    this.fcClient = this.buildFcClient()
  }

  async invokeEvent (serviceName, functionName, eventConfig = {}, qualifier) {
    console.log(
      `\nMissing invokeName argument, will use the first function ${serviceName}/${functionName} as invokeName`
    )
    let event
    if (eventConfig.event) {
      event = eventConfig.event
    } else {
      event = await this.readFile(eventConfig.eventFilePath)
    }

    const rs = await this.fcClient.invokeFunction(
      serviceName,
      functionName,
      event,
      {
        'X-Fc-Log-Type': 'Tail'
      },
      qualifier || 'LATEST'
    )
    const log = rs.headers['x-fc-log-result']
    if (log) {
      this.handlerLog(log)
    }

    console.log(`FC Invoke Result:\n${rs.data}`)
  }

  async invokeHttp (serviceName, functionName, eventConfig = {}, qualifier) {
    let event = await this.readFile(eventConfig.eventFilePath)
    if (event) {
      try {
        event = JSON.parse(event)
      } catch (e) {
        console.log(
          `${path.join(
            process.cwd(),
            eventConfig.eventFilePath || 'invoke.json'
          )} file parsing failed.`
        )
        return
      }
    }

    const q = qualifier ? `.${qualifier}` : ''
    const p = `/proxy/${serviceName}${q}/${functionName}/${event.path || ''}`

    console.log(
      `https://${this.accountId}.${this.region}.fc.aliyuncs.com/2016-08-15/proxy/${serviceName}${q}/${functionName}/`
    )
    console.log(
      `\nMissing invokeName argument, will use the first function ${serviceName}/${functionName} as invokeName`
    )
    await this.request({ ...event, path: p })
  }

  /**
   *
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

  async readFile (eventFilePath) {
    const filePath = path.join(process.cwd(), eventFilePath || 'invoke.json')
    try {
      const text = await fs.readFileSync(filePath)
      return text.toString()
    } catch (e) {
      if (eventFilePath) {
        throw new Error(e.message)
      }
    }
    return ''
  }

  handlerLog (log) {
    console.log('\n========= FC invoke Logs begin =========')
    const decodedLog = Buffer.from(log, 'base64')
    console.log(decodedLog.toString())
    console.log('========= FC invoke Logs end =========\n')
  }
}

module.exports = InvokeRemote
