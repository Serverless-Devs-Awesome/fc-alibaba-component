'use strict'

const _ = require('lodash')
const moment = require('moment')

const { SLS } = require('aliyun-sdk')

class Logs {
  constructor (credentials, region) {
    this.slsClient = new SLS({
      accessKeyId: credentials.AccessKeyID,
      secretAccessKey: credentials.AccessKeySecret,
      endpoint: `http://${region}.sls.aliyuncs.com`,
      apiVersion: '2015-06-01'
    })
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
}

module.exports = Logs
