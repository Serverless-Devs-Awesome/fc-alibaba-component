'use strict'

const _ = require('lodash')

const fse = require('fs-extra')
const path = require('path')
const httpx = require('httpx')
const unzipper = require('unzipper')
const Client = require('./client')
const { red } = require('colors')

class Sync extends Client {
  constructor (credentials, region) {
    super(credentials, region)
    this.fcClient = this.buildFcClient()
  }

  async sync ({
    syncAllFlag,
    onlySyncType,
    serviceName,
    functionName,
    properties
  }) {
    if (!serviceName) {
      throw new Error('ServiceName does not exist.')
    }

    const findFunction = () => {
      if (!functionName) {
        throw new Error('FunctionName does not exist.')
      }
    }

    const pro = _.cloneDeepWith(properties)
    // --service，只同步服务
    if (syncAllFlag || onlySyncType === 'service') {
      console.log(`Starting sync ${serviceName} config.`)
      pro.Service = await this.syncService(serviceName, pro.Service)
      console.log(`End sync ${serviceName} config.`)
    }
    // --tags，只同步标签
    if (syncAllFlag || onlySyncType === 'tags') {
      console.log(`Starting sync ${serviceName} tags.`)
      pro.Service.Tags = await this.syncTags(`services/${serviceName}`)
      console.log(`End sync ${serviceName} tags.`)
    }
    // --function，只同步函数
    if (syncAllFlag || onlySyncType === 'function') {
      findFunction()
      console.log(`Starting sync ${serviceName}/${functionName} config.`)
      pro.Function = await this.syncFunction(serviceName, functionName, pro.Function)
      console.log(`End sync ${serviceName}/${functionName} config.`)
    }
    // --code，只同步代码
    if (syncAllFlag || onlySyncType === 'code') {
      findFunction()
      console.log(`Starting sync ${serviceName}/${functionName} code.`)
      const codeUri = pro.Function.CodeUri || path.join('./', serviceName, functionName)
      try {
        await this.outputFunctionCode(serviceName, functionName, codeUri)
      } catch (e) {
        console.log(red('Failed to sync function code.'))
        throw e
      }
      pro.Function.CodeUri = codeUri
      console.log(`End ${serviceName}/${functionName} code.`)
    }
    // --trigger，只同步触发器
    if (syncAllFlag || onlySyncType === 'trigger') {
      findFunction()
      console.log(`Starting sync ${serviceName}/${functionName} trigger.`)
      pro.Function.Triggers = await this.syncTrigger(serviceName, functionName)
      console.log(`End ${serviceName}/${functionName} trigger.`)
    }

    return JSON.parse(JSON.stringify(pro))
  }

  async syncService (serviceName, service) {
    const { data } = await this.fcClient.getService(serviceName)
    const { description, role, logConfig, vpcConfig, nasConfig, internetAccess } = data
    const serviceData = {
      Description: description,
      InternetAccess: internetAccess,
      Role: role,
      Name: serviceName,
      Tags: service.Tags
    }
    if (vpcConfig) {
      serviceData.Vpc = {
        SecurityGroupId: vpcConfig.securityGroupId,
        VSwitchIds: vpcConfig.vSwitchIds,
        VpcId: vpcConfig.vpcId
      }
    }
    if (nasConfig) {
      serviceData.Nas = {
        UserId: nasConfig.userId,
        GroupId: nasConfig.groupId,
        MountPoints: nasConfig.mountPoints.map(({ serverAddr, mountDir }) => ({
          ServerAddr: serverAddr,
          MountDir: mountDir
        }))
      }
    }
    if (logConfig) {
      serviceData.Log = {
        LogStore: logConfig.logstore,
        Project: logConfig.project
      }
    }
    return serviceData
  }

  async syncTags (resourceArn) {
    const { data } = await this.fcClient.getResourceTags({ resourceArn })
    const { tags = {} } = data || {}
    const t = Object.keys(tags).map(key => ({
      Key: key,
      Value: tags[key]
    }))
    if (t.length === 0) {
      return undefined
    }
    return t
  }

  async syncFunction (serviceName, functionName, proFunction) {
    const { data } = await this.fcClient.getFunction(serviceName, functionName)
    const {
      description,
      runtime,
      handler,
      timeout,
      initializer,
      initializationTimeout,
      memorySize,
      environmentVariables,
      instanceConcurrency,
      customContainerConfig,
      caPort,
      instanceType
    } = data
    return {
      Name: functionName,
      CodeUri: proFunction.CodeUri,
      Description: description,
      Runtime: runtime,
      Handler: handler,
      Timeout: timeout,
      Initializer: initializer,
      InitializationTimeout: initializationTimeout,
      MemorySize: memorySize,
      InstanceConcurrency: instanceConcurrency,
      CustomContainerConfig: customContainerConfig,
      CaPort: caPort,
      InstanceType: instanceType,
      Environment: Object.keys(environmentVariables).map(key => ({
        key: key,
        Value: environmentVariables[key]
      })),
      Triggers: proFunction.Triggers
    }
  }

  async outputFunctionCode (serviceName, functionName, fullOutputDir) {
    const { data } = await this.fcClient.getFunctionCode(serviceName, functionName)
    await fse.ensureDir(fullOutputDir)
    const response = await httpx.request(data.url, { method: 'GET' })

    return await new Promise((resolve, reject) => {
      const unzipExtractor = unzipper.Extract({ path: fullOutputDir })
      unzipExtractor.on('error', err => reject(err)).on('close', resolve)

      response.pipe(unzipExtractor).on('error', err => reject(err))
    })
  }

  async syncTrigger (serviceName, functionName, proFunction) {
    const { data } = await this.fcClient.listTriggers(serviceName, functionName)
    const { triggers = [] } = data || {}
    return triggers.map(item => {
      const { triggerConfig = {}, qualifier, triggerType, sourceArn, invocationRole } = item
      let type = triggerType
      let parameters = {}
      switch (type) {
        case 'http':
          parameters = {
            Qualifier: qualifier,
            AuthType: triggerConfig.authType,
            Methods: triggerConfig.methods
          }
          type = 'HTTP'
          break
        case 'oss':
          parameters = {
            Qualifier: qualifier,
            Bucket: sourceArn.split(':').pop(),
            Events: triggerConfig.events,
            InvocationRole: invocationRole,
            Filter: {
              Prefix: triggerConfig.filter.key.prefix,
              Suffix: triggerConfig.filter.key.suffix
            }
          }
          type = 'OSS'
          break
        case 'timer':
          type = 'Timer'
          parameters = {
            Qualifier: qualifier,
            CronExpression: triggerConfig.cronExpression,
            Enable: triggerConfig.enable,
            Payload: triggerConfig.payload
          }
          break
        case 'cdn_events':
          type = 'CDN'
          parameters = {
            Qualifier: qualifier,
            EventName: triggerConfig.eventName,
            EventVersion: triggerConfig.eventVersion,
            Notes: triggerConfig.notes,
            Filter: {
              Domain: triggerConfig.filter.domain
            },
            InvocationRole: invocationRole
          }
          break
        case 'log':
          type = 'Log'
          parameters = {
            Qualifier: qualifier,
            SourceConfig: {
              LogStore: triggerConfig.sourceConfig.logstore
            },
            JobConfig: {
              MaxRetryTime: triggerConfig.jobConfig.maxRetryTime,
              TriggerInterval: triggerConfig.jobConfig.triggerInterval
            },
            LogConfig: {
              LogStore: triggerConfig.logConfig.logstore,
              Project: triggerConfig.logConfig.project
            },
            FunctionParameter: triggerConfig.functionParameter,
            Enable: triggerConfig.enable,
            InvocationRole: invocationRole
          }
          break
        case 'mns_topic':
          const arnConfig = sourceArn.split(':');
          type = 'MNSTopic'
          parameters = {
            Qualifier: qualifier,
            InvocationRole: invocationRole,
            FilterTag: triggerConfig.filterTag,
            NotifyStrategy: triggerConfig.notifyStrategy,
            NotifyContentFormat: triggerConfig.notifyContentFormat,
            Region: arnConfig[2],
            TopicName: arnConfig.pop().split('/').pop()
          }
          break
        default:
          console.log(`Skip sync trigger: ${item.triggerName}`)
      }
      const triggerData = {
        Name: item.triggerName,
        Type: type,
        Parameters: parameters
      }
      return triggerData
    })
  }
}

module.exports = Sync
