'use strict'

const _ = require('lodash')

const moment = require('moment')
const Logs = require('./utils/logs')
const TAG = require('./utils/tag')
const { existsSync } = require('fs-extra')
const { Component } = require('@serverless-devs/s-core')
const { Service, FcFunction, Trigger, CustomDomain, Alias, Version, InvokeRemote } = require('./utils/fc')
const { execSync } = require('child_process')

const DEFAULT = {
  Region: 'cn-hangzhou',
  Service: 'Default'
}

class FcComponent extends Component {
  // 解析入参
  handlerInputs (inputs) {
    const properties = inputs.Properties || {}
    const credentials = inputs.Credentials || {}
    const state = inputs.State || {}

    const serviceState = state.Service || {}

    const serviceProp = properties.Service || {}
    const functionProp = properties.Function || {}

    const serviceName = serviceProp.Name || serviceState.Name || DEFAULT.Service
    const functionName = functionProp.Name || ''

    const region = properties.Region || DEFAULT.Region

    return {
      properties,
      credentials,
      args: this.args(inputs.Args),
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      region
    }
  }

  // 部署
  async deploy (inputs) {
    // 全局部署
    const projectName = inputs.Project.ProjectName
    const credentials = inputs.Credentials
    const properties = inputs.Properties
    const state = inputs.State || {}
    const { Commands: commands, Parameters: parameters } = this.args(inputs.Args)

    const deployType = commands[0]
    let isDeployAll = false
    if (commands.length === 0) {
      isDeployAll = true
    }

    const serviceInput = properties.Service || {}
    const serviceState = state.Service || {}
    const serviceName = serviceInput.Name
      ? serviceInput.Name
      : serviceState.Name
        ? serviceState.Name
        : DEFAULT.Service
    const functionName = properties.Function.Name

    const output = {}
    const region = properties.Region || DEFAULT.Region

    // 单独部署服务
    if (deployType === 'service' || isDeployAll) {
      const fcService = new Service(credentials, region)
      output.Service = await fcService.deploy(properties, state)
    }

    // 单独部署函数
    if (deployType === 'function' || isDeployAll) {
      if (properties.Function) {
        const fcFunction = new FcFunction(credentials, region)
        output.Function = await fcFunction.deploy(properties, state, projectName, serviceName, commands)
      }
    }

    // 单独部署触发器
    if (deployType === 'trigger' || isDeployAll) {
      if (properties.Function && properties.Function.Triggers) {
        const fcTrigger = new Trigger(credentials, region)
        output.Triggers = await fcTrigger.deploy(properties, serviceName, functionName, commands, parameters)
      }
    }

    // 单独部署标签
    if (deployType === 'tags' || isDeployAll) {
      if (properties.Service && properties.Service.Tags) {
        const tag = new TAG(credentials, region)
        const serviceArn = 'services/' + serviceName
        output.Tags = await tag.deploy(serviceArn, properties.Service.Tags, commands, parameters)
      }
    }

    // 单独部署自定义域名
    if (deployType === 'domain') {
      output.Domains = await this.domain(inputs)
    }

    // 返回结果
    return output
  }

  // 部署自定义域名
  async domain (inputs, isRemove) {
    const {
      credentials,
      properties,
      functionName,
      serviceName,
      args = {},
      region
    } = this.handlerInputs(inputs)
    const parameters = args.Parameters || {}
    const onlyDomainName = parameters.d || parameters.domain
    const fcDomain = new CustomDomain(credentials, region)
    let triggers = properties.Function.Triggers
    if (!_.isArray(triggers)) {
      return
    }
    triggers = triggers.filter(trigger => trigger.Type === 'HTTP' && trigger.Parameters && trigger.Parameters.Domains)

    const triggerConfig = []
    for (const trigger of triggers) {
      if (isRemove) {
        await fcDomain.remove(
          trigger.Parameters.Domains,
          serviceName,
          functionName,
          onlyDomainName
        )
      } else {
        const t = await fcDomain.deploy(
          trigger.Parameters.Domains,
          serviceName,
          functionName,
          onlyDomainName
        )
      
        triggerConfig.push({
          TriggerName: trigger.Name,
          Domains: t
        })
      }
    }
    return triggerConfig
  }

  // 版本
  async version (inputs) {
    const { credentials, region, serviceName, type, args } = this.handlerInputs(inputs)
    const fcVersion = new Version(credentials, region)

    if (type === 'publish') {
      await fcVersion.publish(serviceName, args.description)
    } else if (type === 'delete') {
      await fcVersion.delete(serviceName, args.versionId)
    }
  }

  // 删除版本
  async alias (inputs) {
    const { credentials, region, serviceName, type, args } = this.handlerInputs(inputs)

    const fcAlias = new Alias(credentials, region)

    if (type === 'publish') {
      const config = {
        Name: args.name,
        Version: args.Version,
        Description: args.Description,
        additionalVersionWeight: args.additionalVersionWeight
      }
      const alias = await fcAlias.findAlias(serviceName, args.name)
      if (alias) {
        await fcAlias.update(config, serviceName)
      } else {
        await fcAlias.publish(config, serviceName)
      }
    } else if (type === 'delete') {
      await fcAlias.delete(serviceName, args.aliasName)
    }
  }

  // 移除
  async remove (inputs) {
    const {
      credentials,
      properties,
      functionName,
      serviceName,
      args = {},
      region
    } = this.handlerInputs(inputs)

    const { Commands: commands, Parameters: parameters } = args
    const removeType = commands[0]
    let isDeployAll = false
    if (commands.length === 0) {
      isDeployAll = true
    }

    console.log(removeType, parameters);
    console.log('======================')
    // 15656389.1899690531354629.functioncompute.com
    // 解绑标签
    if (removeType === 'tags') {
      // TODO 指定删除标签
      const tag = new TAG(credentials, region)
      const serviceArn = 'services/' + serviceName
      await tag.remove(serviceArn, parameters)
    }

    if (removeType === 'domain' || isDeployAll) {
      await this.domain(inputs, true);
    }

    // 单独删除触发器
    if (removeType === 'trigger' || isDeployAll) {
      // TODO 指定删除特定触发器
      const fcTrigger = new Trigger(credentials, region)
      await fcTrigger.remove(serviceName, functionName)
    }

    // 单独删除函数
    if (removeType === 'function' || isDeployAll) {
      const fcFunction = new FcFunction(credentials, region)
      await fcFunction.remove(serviceName, functionName)
    }

    // 单独删除服务
    // TODO 服务是全局的，当前组件如何判断是否要删除服务？
    if (removeType === 'service' || isDeployAll) {
      const fcService = new Service(credentials, region)
      await fcService.remove(serviceName)
    }
  }

  // 触发
  async invoke (inputs) {
    const { credentials, type = '', args, functionName, serviceName, region } = this.handlerInputs(
      inputs
    )

    const invokeType = type.toLocaleUpperCase()
    if (invokeType !== 'EVENT' && invokeType !== 'HTTP') {
      throw new Error('Need to specify the function execution type: event or http')
    }

    const invokeRemote = new InvokeRemote(credentials, region)
    if (invokeType === 'EVENT') {
      await invokeRemote.invokeEvent(
        serviceName,
        functionName,
        { eventFilePath: args.eventFilePath, event: args.event },
        args.qualifier
      )
    } else {
      await invokeRemote.invokeHttp(
        serviceName,
        functionName,
        { eventFilePath: args.eventFilePath },
        args.qualifier
      )
    }
  }

  // 日志
  async logs (inputs) {
    const {
      args,
      region,
      serviceProp,
      serviceName,
      functionName,
      credentials
    } = this.handlerInputs(inputs)

    const logConfig = serviceProp.Log

    const projectName = logConfig.Project
    const logStoreName = logConfig.LogStore

    if (_.isEmpty(logConfig) || _.isEmpty(projectName) || _.isEmpty(logStoreName)) {
      throw new Error(
        'Missing Log definition in template.yml.\nRefer to https://github.com/ServerlessTool/fc-alibaba#log'
      )
    }

    if (_.isEmpty(args)) {
      throw new Error('Missing logs options.')
    }

    const cmdParameters = this.args(args).Parameters

    const logs = new Logs(credentials, region)

    if (_.has(cmdParameters, 't') || _.has(cmdParameters, 'tail')) {
      await logs.realtime(projectName, logStoreName, serviceName, functionName)
    } else {
      // Ten minutes ago
      const from = moment()
        .subtract(20, 'minutes')
        .unix()
      const to = moment().unix()

      const query = cmdParameters.k || cmdParameters.keyword
      const type = cmdParameters.t || cmdParameters.type
      const requestId = cmdParameters.r || cmdParameters.requestId

      const queryErrorLog = type === 'failed'

      const historyLogs = await logs.history(
        projectName,
        logStoreName,
        from,
        to,
        serviceName,
        functionName,
        query,
        queryErrorLog,
        requestId
      )

      logs.printLogs(historyLogs)
    }
  }

  // 指标
  async metrics (inputs) {}

  // 安装
  async install (inputs) {}

  // 构建
  async build (inputs) {
    const properties = inputs.Properties
    const functionProperties = properties.Function
    const customContainer = functionProperties.CustomContainer

    const dockerBuild = functionProperties.Runtime === 'custom-container'
    if (dockerBuild) {
      if (!customContainer) {
        throw new Error('No CustomContainer found for container build')
      }
      let dockerFile = 'Dockerfile'
      if (customContainer && customContainer.Dockerfile) {
        dockerFile = customContainer.Dockerfile
      }
      if (!customContainer.Image) {
        throw new Error('No CustomContainer.Image found for container build')
      }
      const imageName = customContainer.Image

      if (!existsSync(dockerFile)) {
        throw new Error('No dockerfile found.')
      }

      try {
        console.log('Building image...')
        execSync(`docker build -t ${imageName} -f ${dockerFile} .`, {
          stdio: 'inherit'
        })
        console.log(`Build image(${imageName}) successfully`)
      } catch (e) {
        console.log(e.message)
        throw e
      }
    }
  }

  // 发布
  async publish (inputs) {}

  // 打包
  async package (inputs) {}

  // NAS操作
  async nas (inputs) {}
}

module.exports = FcComponent
