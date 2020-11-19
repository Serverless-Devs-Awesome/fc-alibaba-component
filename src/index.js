'use strict'

const _ = require('lodash')

const fse = require('fs-extra')
const fs = require('fs')
const yaml = require('js-yaml')
const path = require('path')
const moment = require('moment')

const Logs = require('./utils/logs')
const TAG = require('./utils/tag')
const Builder = require('./utils/fc/builder')
const Install = require('./utils/fc/install')
const Metrics = require('./utils/metrics')
const getHelp = require('./utils/help')
const LocalInvoke = require('./utils/invoke/local/local-invoke')
const DockerInvoke = require('./utils/invoke/docker/docker-invoke')
const RemoteInvoke = require('./utils/invoke/remote/remote-invoke')
const { Component } = require('@serverless-devs/s-core')
const Logger = require('./utils/logger')
const { Service, FcFunction, Trigger, CustomDomain, Alias, Version, Sync, Remove, Nas } = require('./utils/fc')

const DEFAULT = {
  Region: 'cn-hangzhou',
  Service: 'Default'
}

// 创建日志对象
const logger = new Logger()

class FcComponent extends Component {
  constructor () {
    super()
  }

  // 解析入参
  async handlerInputs (inputs) {

    const projectName = inputs.Project.ProjectName
    const properties = inputs.Properties || {}
    const credentials = inputs.Credentials || {}

    const args = this.args(inputs.Args)

    const serviceProp = properties.Service || {}
    const functionProp = properties.Function || {}

    const serviceName = serviceProp.Name || DEFAULT.Service
    const functionName = functionProp.Name || ''
    const region = properties.Region || DEFAULT.Region

    // 初始化this对象
    this.id = region + "-" + serviceName
    await this.init()
    this.state.Region = region
    this.state.ServiceName = serviceName
    this.state.Token = credentials.AccountID
    const state = this.state || inputs.State || {}
    await this.save()

    // 如果账号一致/地域一致/服务一致
    // 则对Service下的VPC、LOG、NAS进行缓存读取
    if(state.Token == credentials.AccountID && state.Region == region && state.ServiceName == serviceName){
      const cacheList = ['Log', 'Vpc', 'Nas']
      for(let i=0;i<cacheList.length;i++){
        if(state[cacheList[i]] && (serviceProp[cacheList[i]] == "Auto" || serviceProp[cacheList[i]] == undefined)){
          serviceProp[cacheList[i]] = state[cacheList[i]]
        }
      }
    }

    return {
      projectName,
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


  async deploy (inputs) {
    this.help(inputs, getHelp(inputs).deploy)

    const {
      projectName,
      properties,
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      args, region
    } = await this.handlerInputs(inputs)

    const commands = args.Commands
    const parameters = args.Parameters

    const deployAll = _.isEmpty(commands)
    const deployAllConfig = (_.isEmpty(commands) && parameters.config)

    const deployService = commands[0] === 'service' || deployAllConfig || deployAll
    const deployFunction = commands[0] === 'function' || deployAllConfig || deployAll
    const deployTriggers = commands[0] === 'trigger' || deployAll
    const deployTags = commands[0] === 'tags' || deployAll
    const deployDomain = commands[0] === 'domain' || deployAll

    const output = {}

    // Service
    if (deployService) {
      const fcService = new Service(commands, parameters, {credentials, region, inputs})

      const hasFunctionAsyncConfig = _.has(functionProp, 'AsyncConfiguration')
      const hasCustomContainerConfig = _.has(functionProp, 'CustomContainerConfig')

      const beforeDeployLog = deployAllConfig ? 'config to be updated' : 'to be deployed'
      const afterDeployLog = deployAllConfig ? 'config update success' : 'deploy success'

      logger.info(`Waiting for service ${serviceName} ${beforeDeployLog}...`)
      output.Service = await fcService.deploy(serviceName, serviceProp, hasFunctionAsyncConfig, hasCustomContainerConfig)
      logger.success(`Service ${serviceName} ${afterDeployLog}\n`)
    }

    // Function
    if (deployFunction) {
      const fcFunction = new FcFunction(credentials, region)

      const onlyDelpoyCode = (parameters.code && !deployAll)
      const onlyDelpoyConfig = (parameters.config || deployAllConfig)

      const beforeDeployLog = onlyDelpoyConfig ? 'config to be updated' : 'to be deployed'
      const afterDeployLog = onlyDelpoyConfig || deployAllConfig ? 'config update success' : 'deploy success'

      logger.info(`Waiting for function ${functionName} ${beforeDeployLog}...`)
      output.Function = await fcFunction.deploy({
        projectName,
        serviceName,
        serviceProp,
        functionName,
        functionProp,
        onlyDelpoyCode,
        onlyDelpoyConfig
      })
      logger.success(`function ${functionName} ${afterDeployLog}\n`)
    }

    // Triggers
    if (deployTriggers) {
      const fcTrigger = new Trigger(credentials, region)
      const triggerName = parameters.n || parameters.name
      output.Triggers = await fcTrigger.deploy(properties, serviceName, functionName, triggerName, commands[0] === 'trigger')
    }

    // Tags
    if (deployTags) {
      const tag = new TAG(credentials, region)
      const tagName = parameters.n || parameters.name
      output.Tags = await tag.deploy(`services/${serviceName}`, properties.Service.Tags, tagName)
    }

    if (deployDomain) {
      // await this.domain(inputs)
      // output.Domains = await this.domain(inputs)
      const doaminResult = await this.domain(inputs)
      if (!output) {
        output.Domains = doaminResult
      }
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
    } = await this.handlerInputs(inputs)
    logger.info(`Start deploying domains ...`)
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
    const { credentials, region, serviceName, args } = await this.handlerInputs(inputs)
    const fcVersion = new Version(credentials, region)
    const { Parameters: parameters = {} } = args

    if (type === 'publish') {
      return await fcVersion.publish(serviceName, parameters.d)
    } else if (type === 'unpublish') {
      return await fcVersion.delete(serviceName, parameters.v || parameters.versionId)
    } else {
      throw new Error(`${type} command not found.`)
    }
  }

  // 别名
  async alias (inputs, type) {
    const { credentials, region, serviceName, args } = await this.handlerInputs(inputs)
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
        return await fcAlias.update(config, serviceName)
      } else {
        return await fcAlias.publish(config, serviceName)
      }
    } else if (type === 'unpublish') {
      await fcAlias.delete(serviceName, configName)
    }
  }

  // 移除
  async remove (inputs) {
    this.help(inputs, getHelp(inputs).remove)
    const {
      credentials,
      functionName,
      serviceName,
      serviceProp,
      region
    } = await this.handlerInputs(inputs)

    const { Commands: commands, Parameters: parameters } = this.args(inputs.Args, ['-f, --force'])
    const removeType = commands[0]
    const fcRemove = new Remove(commands, parameters, { credentials, region, serviceProp })

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
      // Check if NAS auto enabled, if so remove nas-server function if possible
      if (serviceProp && serviceProp.Nas) {
        await fcRemove.removeNasFunctionIfExists(serviceName)
      }

      const fcService = new Service(commands, parameters, {credentials, region})
      await fcService.remove(serviceName)
    }

    // Try to delete auto generated resource
    if (isRemoveAll) {
      await fcRemove.removeAutoGeneratedResourceIfExists()
    }
  }

  /**
   * ---------------------------
   * s invoke remote options:
   *   -e or --event
   *   -f or --event-file <path>
   *   -s or --event-stdin
   *   -q or qualifier
   * ---------------------------
   * s invoke docker options:
   *   -e or --event
   *   -f or --event-file <path>
   *   -s or --event-stdin
   *   -d or --debug-port
   *   --no-reuse
   *   --tmp-dir
   *   --debug-port
   *   --debug-args
   *   --debugger-path
   * ---------------------------
   * s invoke local options:
   *   -e or --event
   *   -f or --event-file <path>
   *   -s or --event-stdin
   * @param {*} inputs
   */
  async invoke (inputs) {
    this.help(inputs, getHelp(inputs).invoke)
    const {
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      args: {
        Commands: commands,
        Parameters: options
      },
      region
    } = await this.handlerInputs(inputs)

    if (commands.length === 0) {
      throw new Error('Input error, use \'s invoke --help\' for info.')
    }

    if (commands[0] === 'remote') {
      const remoteInvoke = new RemoteInvoke(credentials, region, serviceName, functionName, options)
      await remoteInvoke.invoke()
    } else if (commands[0] === 'docker') {
      const dockerInvoke = new DockerInvoke(credentials, region, serviceName, serviceProp, functionName, functionProp, options)
      await dockerInvoke.invoke()
    } else if (commands[0] === 'local') {
      const localInvoke = new LocalInvoke(credentials, region, serviceProp, functionProp, options)
      await localInvoke.invoke()
    }
  }

  // 日志
  async logs (inputs) {
    this.help(inputs, getHelp(inputs).logs)
    const {
      region,
      serviceProp,
      serviceName,
      functionName,
      credentials
    } = await this.handlerInputs(inputs)

    const args = this.args(inputs.Args, undefined, ['s', 'startTime', 'e', 'endTime'], undefined)

    const logConfig = serviceProp.Log

    if (_.isEmpty(logConfig)) {
      throw new Error('Missing Log definition in template.yml.\nRefer to https://github.com/ServerlessTool/fc-alibaba#log')
    }

    const logs = new Logs(credentials, region)

    const { projectName, logStoreName } = logs.processLogAutoIfNeed(logConfig)

    const cmdParameters = args.Parameters

    if (args.Parameters.t || args.Parameters.tail) {
      await logs.realtime(projectName, logStoreName, serviceName, functionName)
    } else {
      let from
      let to
      if ((cmdParameters.s || cmdParameters.startTime) && (cmdParameters.e || cmdParameters.endTime)) {
        from = (new Date(cmdParameters.s || cmdParameters.startTime)).getTime() / 1000
        to = (new Date(cmdParameters.e || cmdParameters.endTime)).getTime() / 1000
      } else {
        // 20 minutes ago
        logger.warn('By default, find logs within 20 minutes...\n')
        from = moment().subtract(20, 'minutes').unix()
        to = moment().unix()
      }

      const query = cmdParameters.k || cmdParameters.keyword
      const type = cmdParameters.t || cmdParameters.type
      const requestId = cmdParameters.r || cmdParameters.requestId

      const queryErrorLog = type === 'failed'

      const historyLogs = await logs.history(projectName, logStoreName, from, to, serviceName, functionName, query, queryErrorLog, requestId)

      logs.printLogs(historyLogs)
    }
  }

  // 指标
  async metrics (inputs) {
    this.help(inputs, getHelp(inputs).metrics)
    const { State = {}, Properties } = inputs
    const { Service = {}, Function = {} } = Properties || State || {}

    const serviceName = Service.Name
    if (!serviceName) {
      throw new Error('Service Name is empty')
    }
    const functionName = Function.Name
    if (!functionName) {
      throw new Error('Function Name is empty')
    }

    const metricsClient = new Metrics(inputs.Credentials || {}, Properties.Region || DEFAULT.Region)
    await metricsClient.start({
      functionName,
      serviceName
    })
  }

  // 安装
  async install (inputs) {
    this.help(inputs, getHelp(inputs).install)

    const {
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      region
    } = await this.handlerInputs(inputs)

    let tempFunctionProp = functionProp
    if(typeof(functionProp) == "object"){
      tempFunctionProp.CodeUri = tempFunctionProp.CodeUri.Src
    }

    const { Commands: commands = [], Parameters: parameters } = this.args(inputs.Args,
      ['i', 'interactive', 'save'],
      [],
      ['--cmd', '-c', '-e', '--env', '-f', '--file', '--save', '--url', '-p', '--package-type', '-r', '--runtime', '-i', '--interactive'])

    const installer = new Install(commands, parameters, {
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp: tempFunctionProp,
      region
    })
    await installer.handle()
  }

  // 构建
  async build (inputs) {
    this.help(inputs, getHelp(inputs).build)
    logger.info('Start to build artifact.')
    const {
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      region
    } = await this.handlerInputs(inputs)

    const { Commands: commands = [], Parameters: parameters } = this.args(inputs.Args)

    const builder = new Builder(commands, parameters, {
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      region
    })

    await builder.handle()
  }

  // 发布
  async publish (inputs) {
    this.help(inputs, getHelp(inputs).publish)
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
    this.help(inputs, getHelp(inputs).unpublish)
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
    this.help(inputs, getHelp(inputs).sync)
    const {
      credentials,
      properties,
      serviceProp,
      functionProp,
      args = {},
      region
    } = await this.handlerInputs(inputs)

    const serviceName = serviceProp.Name
    const functionName = functionProp.Name
    const { Commands: commands, Parameters: parameters } = args
    if (parameters.save && typeof parameters.save !== 'string') {
      throw new Error('Save is empty.')
    }
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
    if (project.AccessAlias) {
      project.Access = project.AccessAlias
      delete project.AccessAlias
    }
    const { ConfigPath } = inputs.Path || {}
    const extname = path.extname(ConfigPath)
    const basename = path.basename(ConfigPath, path.extname(ConfigPath))
    const sourceConfig = yaml.safeLoad(fs.readFileSync(ConfigPath))
    await fse.outputFile(`./.s/${basename}.source_config${extname}`, yaml.dump(sourceConfig))

    sourceConfig[projectName] = { ...project, Properties: pro }
    const u = args.Parameters.save ? path.resolve(process.cwd(), args.Parameters.save): ConfigPath
    await fse.outputFile(u, yaml.dump(sourceConfig))
  }

  // NAS操作
  async nas (inputs) {
    this.help(inputs, getHelp(inputs).nas)
    const {
      credentials,
      serviceName,
      serviceProp,
      region
    } = await this.handlerInputs(inputs)

    const { Commands: commands = [], Parameters: parameters } = this.args(inputs.Args,
      ['n', 'noOverwrite', 'all', 'r', 'recursive', 'f', 'force'],
      [],
      ['--alias', '-a', '-n', '--no-overwrite', '--all', '-r', '--recursive', '-f', '--force']
    )

    logger.info('Loading nas component, this may cost a few minutes...')
    const nasComponent = await this.load('nas', 'Component')
    logger.success('Load nas component successfully.')

    const nas = new Nas(commands, parameters, {
      credentials,
      serviceName,
      serviceProp,
      region,
      nasComponent,
      inputs
    })

    await nas.handle()
  }
}

module.exports = FcComponent
