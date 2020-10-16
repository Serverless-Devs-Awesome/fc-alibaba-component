const Core = require('@alicloud/pop-core')
const FC = require('@alicloud/fc2')
const express = require('express')
const path = require('path')
const StartServer = require('../start-server')
const { Version, Alias } = require('../fc')

const requestOption = {
  method: 'GET'
}

class Metrics {
  constructor (credentials, region) {
    this.accountId = credentials.AccountID
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region

    this.fcClient = new FC(credentials.AccountID, {
      accessKeyID: credentials.AccessKeyID,
      accessKeySecret: credentials.AccessKeySecret,
      region: region,
      timeout: 60000
    })
    this.cmsClient = new Core({
      accessKeyId: credentials.AccessKeyID,
      accessKeySecret: credentials.AccessKeySecret,
      endpoint: `http://metrics.${region}.aliyuncs.com`,
      apiVersion: '2018-03-08'
    })
    this.version = new Version(credentials, region)
    this.alias = new Alias(credentials, region)
  }

  async get ({
    serviceName,
    functionName,
    endTime,
    startTime,
    period = 60,
    qualifier,
    metric,
    Project = 'acs_fc'
  }) {
    const params = {
      Project,
      Dimensions: [{
        userId: this.accountId,
        region: this.region,
        serviceName,
        functionName
      }],
      Period: period,
      Metric: metric,
      EndTime: endTime,
      StartTime: startTime
    }
    // 支持 qualifier 的指标
    if (['FunctionQualifierDestinationSuccessed', 'FunctionQualifierDestinationErrors', 'FunctionQualifierAsyncEventExpiredDropped'].includes(metric)) {
      params.Dimensions[0].qualifier = qualifier
    }
    params.Dimensions = JSON.stringify(params.Dimensions)

    console.log('params:: ', params)

    return await this.cmsClient.request('QueryMetricList', params, requestOption)
  }

  async start (params) {
    const uri = path.join(__dirname, './metrics/build')
    const that = this

    function callback (app) {
      app.use('/static', express.static(`${uri}/static`))

      // 设置跨域访问
      app.all('*', function (req, res, next) {
        res.header('Access-Control-Allow-Origin', '*')
        res.header('Access-Control-Allow-Headers', 'X-Requested-With')
        res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS')
        res.header('X-Powered-By', ' 3.2.1')
        res.header('Content-Type', 'application/json;charset=utf-8')
        next()
      })

      app.get('/', (req, res) => {
        res.header('Content-Type', 'text/html;charset=utf-8')
        res.sendFile(`${uri}/index.html`)
      })

      app.get('/get/metric', async (req, res) => {
        const { query } = req
        console.log('收到 /get/metric 请求：', query.metric)
        const result = await that.get({ ...params, ...query })
        console.log('result: ', result.Datapoints)
        console.log('')
        if (result.Datapoints) {
          res.send(result.Datapoints)
        } else {
          res.send(500)
        }
      })

      app.get('/get/version', async (req, res) => {
        console.log('收到 /get/version 请求')
        const list = await that.version.list(params.serviceName)
        if (list.data && list.data.versions) {
          res.send(list.data.versions)
        } else {
          res.send({
            error: true,
            message: list
          })
        }
      })

      app.get('/get/alias', async (req, res) => {
        console.log('收到 /get/alias 请求')
        const list = await that.alias.list(params.serviceName)
        if (list.data && list.data.aliases) {
          res.send(list.data.aliases)
        } else {
          res.send({
            error: true,
            message: list
          })
        }
      })
    }

    const server = new StartServer({ callback })
    server.start()
    // 用于监听 ctrl + c 信号， 手动终止服务。
    process.on('SIGINT', function () {
      server.stop()
      process.exit()
    })
  }
}

module.exports = Metrics
