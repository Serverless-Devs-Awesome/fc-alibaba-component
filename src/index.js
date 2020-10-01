'use strict'

const _ = require('lodash')

const fse = require('fs-extra')
const yaml = require('js-yaml')
const moment = require('moment')

const Logs = require('./utils/logs')
const TAG = require('./utils/tag')
const Builder = require('./utils/fc/builder')
const Install = require('./utils/fc/install')

const { Component } = require('@serverless-devs/s-core')
const { green, yellow, red } = require('colors')
const { Service, FcFunction, Trigger, CustomDomain, Alias, Version, InvokeRemote, Sync } = require('./utils/fc')

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
    const args = this.args(inputs.Args)

    const serviceState = state.Service || {}

    const serviceProp = properties.Service || {}
    const functionProp = properties.Function || {}

    const serviceName = serviceProp.Name || serviceState.Name || DEFAULT.Service
    const functionName = functionProp.Name || ''

    const region = properties.Region || DEFAULT.Region

    return {
      properties,
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      args,
      region
    }
  }

  /**
   * deploy usage:
   *
   * s deploy
   * s deploy --config

   * s deploy service
   * s deploy function

   * s deploy function --config
   * s deploy function --code
   *
   * s deploy tags (-k/--key)
   * s deploy domain （-d/--domain)
   * s deploy trigger （-n/--name)
   * @param {*} inputs
   */
  async deploy (inputs) {
    const {
      projectName,
      properties,
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      args, region
    } = this.handlerInputs(inputs)

    const commands = args.Commands
    const parameters = args.Parameters

    const deployAll = (_.isEmpty(commands) && _.isEmpty(parameters))
    const deployAllConfig = (_.isEmpty(commands) && parameters.config)

    const deployService = commands[0] === 'service' || deployAllConfig || deployAll
    const deployFunction = commands[0] === 'function' || deployAllConfig || deployAll
    const deployTriggers = commands[0] === 'trigger' || deployAll
    const deployTags = commands[0] === 'tags' || deployAll
    const deployDomain = commands[0] === 'domain' || deployAll

    // Service
    if (deployService) {
      const fcService = new Service(credentials, region)

      const hasFunctionAsyncConfig = _.has(functionProp, 'AsyncConfiguration')
      const hasCustomContainerConfig = _.has(functionProp, 'CustomContainerConfig')

      const beforeDeployLog = deployAllConfig ? 'config to be updated' : 'to be deployed'
      const afterDeployLog = deployAllConfig ? 'config update success' : 'deploy success'

      console.log(`Waiting for service ${serviceName} ${beforeDeployLog}...`)
      await fcService.deploy(serviceName, serviceProp, hasFunctionAsyncConfig, hasCustomContainerConfig)
      console.log(green(`service ${serviceName} ${afterDeployLog}\n`))
    }

    // Function
    if (deployFunction) {
      const fcFunction = new FcFunction(credentials, region)

      const onlyDelpoyCode = (parameters.code && !deployAll)
      const onlyDelpoyConfig = (parameters.config || deployAllConfig)

      const beforeDeployLog = onlyDelpoyConfig ? 'config to be updated' : 'to be deployed'
      const afterDeployLog = onlyDelpoyConfig || deployAllConfig ? 'config update success' : 'deploy success'

      console.log(`Waiting for function ${functionName} ${beforeDeployLog}...`)
      await fcFunction.deploy({
        projectName,
        serviceName,
        serviceProp,
        functionName,
        functionProp,
        onlyDelpoyCode,
        onlyDelpoyConfig
      })
      console.log(green(`function ${functionName} ${afterDeployLog}\n`))
    }

    // Triggers
    if (deployTriggers) {
      const fcTrigger = new Trigger(credentials, region)
      const triggerName = parameters.n || parameters.name
      await fcTrigger.deploy(properties, serviceName, functionName, triggerName, commands[0] === 'trigger')
    }

    // Tags
    if (deployTags) {
      const tag = new TAG(credentials, region)
      const tagName = parameters.n || parameters.name
      await tag.deploy(`services/${serviceName}`, properties.Service.Tags, tagName)
    }

    if (deployDomain) {
      await this.domain(inputs)
    }
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
  async version (inputs, type) {
    const { credentials, region, serviceName, args } = this.handlerInputs(inputs)
    const fcVersion = new Version(credentials, region)
    const { Parameters: parameters = {} } = args

    if (type === 'publish') {
      await fcVersion.publish(serviceName, parameters.d)
    } else if (type === 'unpublish') {
      await fcVersion.delete(serviceName, parameters.v || parameters.versionId)
    } else {
      throw new Error(`${type} command not found.`)
    }
  }

  // 删除版本
  async alias (inputs, type) {
    const { credentials, region, serviceName, args } = this.handlerInputs(inputs)
    const { Parameters: parameters = {} } = args
    const { n, name, v, versionId, d, description, gv, w } = parameters
    const configName = n || name

    const fcAlias = new Alias(credentials, region)

    if (type === 'publish') {
      const additionalVersionWeight = {}
      if (gv && w) {
        additionalVersionWeight[gv] = w / 100
      }

      const config = {
        Name: configName,
        Version: v || versionId,
        Description: d || description,
        additionalVersionWeight
      }
      const alias = await fcAlias.findAlias(serviceName, configName)
      if (alias) {
        await fcAlias.update(config, serviceName)
      } else {
        await fcAlias.publish(config, serviceName)
      }
    } else if (type === 'unpublish') {
      await fcAlias.delete(serviceName, configName)
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

    let isRemoveAll = false
    if (commands.length === 0) {
      isRemoveAll = true
    }

    // 解绑标签
    if (removeType === 'tags' || isRemoveAll) {
      // TODO 指定删除标签
      const tag = new TAG(credentials, region)
      const serviceArn = 'services/' + serviceName
      await tag.remove(serviceArn, parameters)
    }

    if (removeType === 'domain' || isRemoveAll) {
      await this.domain(inputs, true)
    }

    // 单独删除触发器
    if (removeType === 'trigger' || isRemoveAll) {
      // TODO 指定删除特定触发器
      const fcTrigger = new Trigger(credentials, region)
      await fcTrigger.remove(serviceName, functionName, parameters)
    }

    // 单独删除函数
    if (removeType === 'function' || isRemoveAll) {
      const fcFunction = new FcFunction(credentials, region)
      await fcFunction.remove(serviceName, functionName)
    }

    // 单独删除服务
    // TODO 服务是全局的，当前组件如何判断是否要删除服务？
    if (removeType === 'service' || isRemoveAll) {
      const fcService = new Service(credentials, region)
      await fcService.remove(serviceName)
    }
  }

  // 触发
  async invoke (inputs) {
    const { credentials, args, functionName, serviceName, region } = this.handlerInputs(inputs)
    const { Commands: commands = [], Parameters: parameters } = args
    const invokeCommand = commands[0]
    if (!invokeCommand || !parameters.type) {
      throw new Error('Invoke command error,example: s invoke remote --type event/http')
    }

    const invokeType = parameters.type.toLocaleUpperCase()
    if (invokeType !== 'EVENT' && invokeType !== 'HTTP') {
      throw new Error('Need to specify the function execution type: event or http')
    }

    let invokeClient
    if (invokeCommand === 'remote') {
      invokeClient = new InvokeRemote(credentials, region)
    }

    if (invokeType === 'EVENT') {
      await invokeClient.invokeEvent(
        serviceName,
        functionName,
        { eventFilePath: parameters.eventFilePath, event: parameters.event },
        parameters.qualifier
      )
    } else {
      await invokeClient.invokeHttp(
        serviceName,
        functionName,
        { eventFilePath: parameters.eventFilePath },
        parameters.qualifier
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

    if (_.isEmpty(logConfig)) {
      throw new Error('Missing Log definition in template.yml.\nRefer to https://github.com/ServerlessTool/fc-alibaba#log')
    }

    console.log(yellow('by default, find logs within 20 minutes...\n'))

    const logs = new Logs(credentials, region)

    const { projectName, logStoreName } = logs.processLogAutoIfNeed(logConfig)

    const cmdParameters = args.Parameters

    if (_.has(cmdParameters, 't') || _.has(cmdParameters, 'tail')) {
      await logs.realtime(projectName, logStoreName, serviceName, functionName)
    } else {
      // 20 minutes ago
      const from = moment().subtract(20, 'minutes').unix()
      const to = moment().unix()

      const query = cmdParameters.k || cmdParameters.keyword
      const type = cmdParameters.t || cmdParameters.type
      const requestId = cmdParameters.r || cmdParameters.requestId

      const queryErrorLog = type === 'failed'

      const historyLogs = await logs.history(projectName, logStoreName, from, to, serviceName, functionName, query, queryErrorLog, requestId)

      logs.printLogs(historyLogs)
    }
  }

  // 指标
  async metrics (inputs) {}

  // 安装
  async install (inputs) {
    this.help(inputs, {
      description: `Usage: s install [command] [packageNames...] [-r|--runtime <runtime>] [-p|--package-type <type>] [--save] [-e|--env key=val ...]

        install dependencies for your project.`,
      commands: [{
        name: 'docker',
        desc: 'use docker to install dependencies.'
      }],
      args: [{
        name: '-e, --env <env>',
        desc: 'environment variable, ex. -e PATH=/code/bin (default: [])'
      }, {
        name: '-r, --runtime <runtime>',
        desc: 'function runtime, avaliable choice is: nodejs6, nodejs8, nodejs10, nodejs12, python2.7, python3, java8, php7.2, dotnetcore2.1, custom, custom-container.'
      }, {
        name: '-p, --package-type <type>',
        desc: 'avaliable package type option: pip, apt, npm.'
      }, {
        name: '--url',
        desc: 'for nodejs this can be configured as custom registry, for python this should be Base URL of Python Package Index (default https://pypi.org/simple).'
      }, {
        name: '--save',
        desc: 'save install command to fcfile.'
      }, {
        name: '-f, --file',
        desc: 'use fcfile before installing, this path should be relative to your codeUri.'
      }
      ]
    })

    const { Commands: commands = [], Parameters: parameters } = this.args(inputs.Args, ['i', 'interactive', 'save'])
    const { e, env, r, runtime, p, packageType, url, c, cmd, f, file, i, interactive } = parameters
    const installer = new Install()

    if (commands.length == 0) {
      console.log(red('input error, use \'s install --help\' for info.'))
      throw new Error('input error.')
    }

    const installCommand = commands[0]
    if (!_.includes(['docker'], installCommand)) {
      console.log(red(`Install command error, unknown subcommand '${installCommand}', example: s install docker`))
      throw new Error('Input error.')
    }

    // commands
    const useDocker = installCommand == 'docker'
    let installAll = true; let packages = []
    // console.log(commands);
    if (commands.length > 1) {
      packages = commands.slice(1)
      installAll = false
    }
    const cmdArgs = {
      env: [].concat(e || env || []),
      runtime: r || runtime,
      packageType: p || packageType,
      registryUrl: url,
      cmd: c || cmd,
      interactive: parameters.hasOwnProperty('i') || parameters.hasOwnProperty('interactive'),
      save: parameters.hasOwnProperty('save'),
      fcFile: f || file || 'fcfile',
      url: url,
      installAll: installAll,
      packages: packages
    }

    if (cmdArgs.save && installAll) {
      console.log(red('--save should be use with packages, such as \'s install docker hexo --save\''))
      throw new Error('Input error.')
    }

    if (cmdArgs.interactive && cmdArgs.cmd) {
      console.log(red('\'--interactive\' should not be used with \'--cmd\''))
      throw new Error('Input error.')
    }

    if (cmdArgs.packageType && cmdArgs.installAll) {
      console.log(red('\'--package-type\' should be used to install packages, but no packageName specified.'))
      throw new Error('Input error.')
    }

    if (cmdArgs.save && cmdArgs.installAll) {
      console.log(red('\'--save\' should be used to record installing packages, but no packageName specified.'))
      throw new Error('Input error.')
    }

    console.log('Start to install dependency.')
    const properties = inputs.Properties
    const state = inputs.State || {}

    const serviceInput = properties.Service || {}
    const serviceState = state.Service || {}
    const serviceName = serviceInput.Name
      ? serviceInput.Name
      : serviceState.Name
        ? serviceState.Name
        : DEFAULT.Service
    const functionInput = properties.Function
    const functionName = functionInput.Name

    if (useDocker) {
      console.log('Start installing functions using docker.')
      await installer.installInDocker({ serviceName, serviceProps: serviceInput, functionName, functionProps: functionInput, cmdArgs })
      return
    }

    if (installAll) {
      await installer.installAll(serviceName, serviceInput, functionName, functionInput, interactive, useDocker, false)
    }

    console.log('Install artifact successfully.')
  }

  // 构建
  async build (inputs) {
    this.help(inputs, {
      description: `Usage: s build [command]

      Build the dependencies.`,
      commands: [{
        name: 'docker',
        desc: 'use docker to build dependencies.'
      }, {
        name: 'local',
        desc: 'build dependencies directly.'
      }, {
        name: 'image',
        desc: 'build image for custom-runtime project.'
      }]
    })
    console.log('Start to build artifact.')
    const properties = inputs.Properties
    const state = inputs.State || {}
    const { Commands: commands = [], Parameters: parameters } = this.args(inputs.Args)
    const serviceInput = properties.Service || {}
    const serviceState = state.Service || {}
    const serviceName = serviceInput.Name
      ? serviceInput.Name
      : serviceState.Name
        ? serviceState.Name
        : DEFAULT.Service
    const functionInput = properties.Function
    const functionName = functionInput.Name

    if (commands.length == 0) {
      console.log(red('input error, use \'s build --help\' for info.'))
      throw new Error('input error.')
    }
    const buildCommand = commands[0]
    if (!_.includes(['docker', 'local', 'image'], buildCommand)) {
      console.log(red(`Install command error, unknown subcommand '${buildCommand}', use 's build --help' for info.`))
      throw new Error('Input error.')
    }

    const builder = new Builder()
    const buildImage = buildCommand === 'image'
    if (buildImage) {
      if (functionInput.Runtime != 'custom-container') {
        console.log(red(`'image' should only be used to build 'custom-container' project, your project is ${functionInput.Runtime}`))
        throw new Error('Input error.')
      }
      await builder.buildImage()
      return
    }

    // serviceName, serviceProps, functionName, functionProps, useDocker, verbose
    const useDocker = buildCommand === 'docker'
    if (useDocker) {
      console.log('Use docker for building.')
    }
    await builder.build(serviceName, serviceInput, functionName, functionInput, useDocker, true)

    console.log('Build artifact successfully.')
  }

  // 发布
  async publish (inputs) {
    const { Commands: commands } = this.args(inputs.Args)
    const publishType = commands[0]

    const publishFunction = {
      version: async () => await this.version(inputs, 'publish'),
      alias: async () => await this.alias(inputs, 'publish')
    }
    if (publishFunction[publishType]) {
      await publishFunction[publishType]()
    } else {
      throw new Error(`${publishType} command not found.`)
    }
  }

  // 删除
  async unpublish (inputs) {
    const { Commands: commands } = this.args(inputs.Args)
    const unPublishType = commands[0]

    const unPublishFunction = {
      version: async () => await this.version(inputs, 'unpublish'),
      alias: async () => await this.alias(inputs, 'unpublish')
    }
    if (unPublishFunction[unPublishType]) {
      await unPublishFunction[unPublishType]()
    } else {
      throw new Error(`${unPublishType} command not found.`)
    }
  }

  // 同步
  async sync (inputs) {
    const {
      credentials,
      properties,
      serviceProp,
      functionProp,
      args = {},
      region
    } = this.handlerInputs(inputs)

    const serviceName = serviceProp.Name
    const functionName = functionProp.Name
    const { Commands: commands } = args
    if (commands.length > 1) {
      throw new Error('Commands error.')
    }
    const syncAllFlag = commands.length === 0
    const onlySyncType = commands[0]

    const syncClient = new Sync(credentials, region)
    const pro = await syncClient.sync({
      syncAllFlag,
      onlySyncType,
      serviceName,
      functionName,
      properties
    })

    const project = _.cloneDeepWith(inputs.Project)
    const projectName = project.ProjectName
    delete project.ProjectName
    const yData = yaml.dump({
      [projectName]: {
        ...project,
        Properties: pro
        // ...(_.assign(properties, pro)),
      }
    })
    await fse.outputFile('./template.yaml', yData)
  }

  // 打包
  async package (inputs) {}

  // NAS操作
  async nas (inputs) {}
}

module.exports = FcComponent
