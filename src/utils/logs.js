'use strict'

const _ = require('lodash')

const debug = require('debug')('fun:deploy')
const getUuid = require('uuid-by-string')
const moment = require('moment')
const definition = require('./tpl/definition')
const Log = require('@alicloud/log')

const { SLS } = require('aliyun-sdk')
const { promiseRetry } = require('./common')
const { red, green } = require('colors')

const FIVE_SPACES = '     '
const TEN_SPACES = '          '

class Logs {
  constructor (credentials, region, useAliyunSdk = true) {
    this.accountId = credentials.AccountID
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region

    if (useAliyunSdk) {
      this.slsClient = new SLS({
        accessKeyId: this.accessKeyID,
        secretAccessKey: this.accessKeySecret,
        endpoint: `http://${this.region}.sls.aliyuncs.com`,
        apiVersion: '2015-06-01'
      })
    } else {
      this.slsClient = new Log({
        region: this.region,
        accessKeyId: this.accessKeyID,
        accessKeySecret: this.accessKeySecret
      })
    }
  }

  sleep (ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async getLogs ({ projectName, logStoreName, timeStart, timeEnd, serviceName, functionName }) {
    const requestParams = {
      projectName,
      logStoreName,
      from: timeStart,
      to: timeEnd,
      topic: serviceName,
      query: functionName
    }

    let count
    let xLogCount
    let xLogProgress = 'Complete'

    let result

    do {
      const response = await new Promise((resolve, reject) => {
        this.slsClient.getLogs(requestParams, (error, data) => {
          if (error) {
            reject(error)
            return
          }
          resolve(data)
        })
      })
      const body = response.body

      if (_.isEmpty(body)) {
        continue
      }

      count = _.keys(body).length

      xLogCount = response.headers['x-log-count']
      xLogProgress = response.headers['x-log-progress']

      let requestId
      result = _.values(body).reduce((acc, cur) => {
        const currentMessage = cur.message
        const found = currentMessage.match('(\\w{8}(-\\w{4}){3}-\\w{12}?)')

        if (!_.isEmpty(found)) {
          requestId = found[0]
        }

        if (requestId) {
          if (!_.has(acc, requestId)) {
            acc[requestId] = {
              timestamp: cur.__time__,
              time: moment.unix(cur.__time__).format('YYYY-MM-DD H:mm:ss'),
              message: ''
            }
          }
          acc[requestId].message = acc[requestId].message + currentMessage
        }

        return acc
      }, {})
    } while (xLogCount !== count && xLogProgress !== 'Complete')

    return result
  }

  filterByKeywords (logsList = {}, { requestId, query, queryErrorLog = false }) {
    let logsClone = _.cloneDeep(logsList)

    if (requestId) {
      logsClone = _.pick(logsClone, [requestId])
    }

    if (query) {
      logsClone = _.pickBy(logsClone, (value, key) => {
        const replaceLog = value.message.replace(new RegExp(/(\r)/g), '\n')
        return replaceLog.indexOf(query) !== -1
      })
    }

    if (queryErrorLog) {
      logsClone = _.pickBy(logsClone, (value, key) => {
        const replaceLog = value.message.replace(new RegExp(/(\r)/g), '\n')
        return replaceLog.indexOf(' [ERROR] ') !== -1 || replaceLog.indexOf('Error: ') !== -1
      })
    }

    return logsClone
  }

  replaceLineBreak (logsList = {}) {
    return _.mapValues(logsList, (value, key) => {
      value.message = value.message.replace(new RegExp(/(\r)/g), '\n')
      return value
    })
  }

  printLogs (historyLogs) {
    _.values(historyLogs).forEach((data) => {
      console.log(`\n${data.message}`)
    })
  }

  async history (
    projectName,
    logStoreName,
    timeStart,
    timeEnd,
    serviceName,
    functionName,

    query,
    queryErrorLog = false,
    requestId
  ) {
    const logsList = await this.getLogs({
      projectName,
      logStoreName,
      timeStart,
      timeEnd,
      serviceName,
      functionName
    })

    return this.filterByKeywords(this.replaceLineBreak(logsList), {
      query,
      requestId,
      queryErrorLog
    })
  }

  async realtime (projectName, logStoreName, serviceName, functionName) {
    let timeStart
    let timeEnd
    let times = 1800

    const consumedTimeStamps = []

    while (times > 0) {
      await this.sleep(1000)
      times = times - 1

      timeStart = moment()
        .subtract(10, 'seconds')
        .unix()
      timeEnd = moment().unix()

      const pulledlogs = await this.getLogs({
        projectName,
        logStoreName,
        timeStart,
        timeEnd,
        serviceName,
        functionName
      })

      if (_.isEmpty(pulledlogs)) {
        continue
      }

      const notConsumedLogs = _.pickBy(pulledlogs, (data, requestId) => {
        return !_.includes(consumedTimeStamps, data.timestamp)
      })

      if (_.isEmpty(notConsumedLogs)) {
        continue
      }

      const replaceLogs = this.replaceLineBreak(notConsumedLogs)

      this.printLogs(replaceLogs)

      const pulledTimeStamps = _.values(replaceLogs).map((data) => {
        return data.timestamp
      })

      consumedTimeStamps.push(...pulledTimeStamps)
    }
  }

  generateSlsProjectName (accountId, region) {
    const uuidHash = getUuid(accountId)
    return `aliyun-fc-${region}-${uuidHash}`
  }

  generateDefaultLogConfig () {
    return {
      project: this.generateSlsProjectName(this.accountId, this.region),
      logStore: 'function-log'
    }
  }

  async createSlsProject (projectName, description) {
    await promiseRetry(async (retry, times) => {
      try {
        await this.slsClient.createProject(projectName, {
          description
        })
      } catch (ex) {
        if (ex.code === 'Unauthorized') {
          throw ex
        } else if (ex.code === 'ProjectAlreadyExist') {
          throw new Error(red(`error: sls project ${projectName} already exist, it may be in other region or created by other users.`))
        } else if (ex.code === 'ProjectNotExist') {
          throw new Error(red('Please go to https://sls.console.aliyun.com/ to open the LogServce.'))
        } else {
          debug('error when createProject, projectName is %s, error is: \n%O', projectName, ex)
          console.log(red(`\tretry ${times} times`))
          retry(ex)
        }
      }
    })
  }

  async slsProjectExist (projectName) {
    let projectExist = true
    await promiseRetry(async (retry, times) => {
      try {
        await this.slsClient.getProject(projectName)
      } catch (ex) {
        if (ex.code === 'Unauthorized') {
          throw new Error(red(`Log Service '${projectName}' may create by others, you should use a unique project name.`))
        } else if (ex.code !== 'ProjectNotExist') {
          // TODO:
          console.log('error when getProject, projectName is %s, error is: \n%O', projectName, ex)
          console.log(red(`\tretry ${times} times`))
          retry(ex)
        } else { projectExist = false }
      }
    })
    return projectExist
  }

  async makeSlsProject (projectName, description) {
    const projectExist = await this.slsProjectExist(projectName)

    let create = false
    if (projectExist) {
      // no update project api
      // only description can be updated by console.
      debug('sls project exists, but could not be updated')
    } else {
      await this.createSlsProject(projectName, description)
      create = true
    }

    return create
  }

  async makeLogstore ({
    projectName,
    logStoreName,
    ttl = 3600,
    shardCount = 1
  }) {
    let exists = true
    await promiseRetry(async (retry, times) => {
      try {
        await this.slsClient.getLogStore(projectName, logStoreName)
      } catch (ex) {
        if (ex.code !== 'LogStoreNotExist') {
          // TODO:
          console.log('error when getLogStore, projectName is %s, logstoreName is %s, error is: \n%O', projectName, logStoreName, ex)

          console.log(red(`\t\tretry ${times} times`))

          retry(ex)
        } else { exists = false }
      }
    })

    if (!exists) {
      await promiseRetry(async (retry, times) => {
        try {
          await this.slsClient.createLogStore(projectName, logStoreName, {
            ttl,
            shardCount
          })
        } catch (ex) {
          if (ex.code === 'Unauthorized') {
            throw ex
          }
          // TODO:
          console.log('error when createLogStore, projectName is %s, logstoreName is %s, error is: \n%O', projectName, logStoreName, ex)
          console.log(red(`\t\tretry ${times} times`))
          retry(ex)
        }
      })
    } else {
      await promiseRetry(async (retry, times) => {
        try {
          await this.slsClient.updateLogStore(projectName, logStoreName, {
            ttl,
            shardCount
          })
        } catch (ex) {
          // TODO:
          console.log('error when updateLogStore, projectName is %s, logstoreName is %s, error is: \n%O', projectName, logStoreName, ex)
          if (ex.code === 'Unauthorized') {
            throw ex
          }
          if (ex.code !== 'ParameterInvalid' && ex.message !== 'no parameter changed') {
            console.log(red(`\t\tretry ${times} times`))
            retry(ex)
          } else {
            throw ex
          }
        }
      })
    }
  }

  async makeLogstoreIndex (projectName, logstoreName) {
    // create index if index not exist.
    await promiseRetry(async (retry, times) => {
      try {
        try {
          await this.slsClient.getIndexConfig(projectName, logstoreName)
          return
        } catch (ex) {
          if (ex.code !== 'IndexConfigNotExist') {
            debug('error when getIndexConfig, projectName is %s, logstoreName is %s, error is: \n%O', projectName, logstoreName, ex)

            throw ex
          }
        }

        // create default logstore index. index configuration is same with sls console.
        debug('logstore index not exist, try to create a default index for project %s logstore %s', projectName, logstoreName)
        await this.slsClient.createIndex(projectName, logstoreName, {
          ttl: 10,
          line: {
            caseSensitive: false,
            chn: false,
            token: [...', \'";=()[]{}?@&<>/:\n\t\r']
          }
        })
        debug('create default index success for project %s logstore %s', projectName, logstoreName)
      } catch (ex) {
        debug('error when createIndex, projectName is %s, logstoreName is %s, error is: \n%O', projectName, logstoreName, ex)

        console.log(red(`\t\t\tretry ${times} times`))
        retry(ex)
      }
    })
  }

  async makeSlsAuto (projectName, description, logStoreName) {
    await this.makeSlsProject(projectName, description)

    await this.makeLogstore({
      projectName,
      logStoreName
    })

    await this.makeLogstoreIndex(projectName, logStoreName)
  }

  async transformLogConfig (logConfig) {
    if (definition.isLogConfigAuto(logConfig)) {
      const defaultLogConfig = this.generateDefaultLogConfig()

      console.log(`${FIVE_SPACES}using 'Log: Auto'. serverless tool will generate default sls project.`)
      const description = 'create default log project by serverless tool'
      await this.makeSlsAuto(defaultLogConfig.project, description, defaultLogConfig.logStore)
      console.log(`${TEN_SPACES}project: ${defaultLogConfig.project}, logStore: ${defaultLogConfig.logStore}`)
      console.log(green(`${FIVE_SPACES}generated default Log config done.`))

      return defaultLogConfig
    }

    return {
      project: logConfig.Project || '',
      logstore: logConfig.LogStore || ''
    }
  }
}

module.exports = Logs
