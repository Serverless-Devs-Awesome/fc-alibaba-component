'use strict'

const _ = require('lodash')

const fse = require('fs-extra')
const yaml = require('js-yaml')
const moment = require('moment')

const Logs = require('./utils/logs')
const TAG = require('./utils/tag')
const Builder = require('./utils/fc/builder')
const Install = require('./utils/fc/install')
const Metrics = require('./utils/metrics')

const LocalInvoke = require('./utils/invoke/local/local-invoke')
const DockerInvoke = require('./utils/invoke/docker/docker-invoke')
const RemoteInvoke = require('./utils/invoke/remote/remote-invoke')

const { Component } = require('@serverless-devs/s-core')
const { green, yellow, red } = require('colors')
const { Service, FcFunction, Trigger, CustomDomain, Alias, Version, Sync } = require('./utils/fc')

const DEFAULT = {
  Region: 'cn-hangzhou',
  Service: 'Default'
}

class FcComponent extends Component {
  // 解析入参
  handlerInputs (inputs) {
    const projectName = inputs.Project.ProjectName
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

    const output = {}

    // Service
    if (deployService) {
      const fcService = new Service(credentials, region)

      const hasFunctionAsyncConfig = _.has(functionProp, 'AsyncConfiguration')
      const hasCustomContainerConfig = _.has(functionProp, 'CustomContainerConfig')

      const beforeDeployLog = deployAllConfig ? 'config to be updated' : 'to be deployed'
      const afterDeployLog = deployAllConfig ? 'config update success' : 'deploy success'

      console.log(`Waiting for service ${serviceName} ${beforeDeployLog}...`)
      output.Service = await fcService.deploy(serviceName, serviceProp, hasFunctionAsyncConfig, hasCustomContainerConfig)
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
      output.Function = await fcFunction.deploy({
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
    } = this.handlerInputs(inputs)

    if (commands[0] === 'remote') {
      const remoteInvoke = new RemoteInvoke(credentials, region, serviceName, functionName, options)
      await remoteInvoke.invoke()
    } else if (commands[0] === 'docker') {
      const dockerInvoke = new DockerInvoke(credentials, serviceName, serviceProp, functionName, functionProp, options)
      await dockerInvoke.invoke()
    } else if (commands[0] === 'local') {
      const localInvoke = new LocalInvoke(credentials, region, serviceProp, functionProp, options)
      await localInvoke.invoke()
    }
  }

  // 日志
  async logs (inputs) {

    const {
      region,
      serviceProp,
      serviceName,
      functionName,
      credentials
    } = this.handlerInputs(inputs)

    const args = this.args(inputs.Args, undefined, ["s", "startTime", "e", "endTime"], undefined)

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
      if((cmdParameters.s || cmdParameters.startTime) && (cmdParameters.e || cmdParameters.endTime)){
        from = (new Date(cmdParameters.s || cmdParameters.startTime)).getTime()/1000
        to = (new Date(cmdParameters.e || cmdParameters.endTime)).getTime()/1000
      }else{
        // 20 minutes ago
        console.log(yellow('By default, find logs within 20 minutes...\n'))
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
    this.help(inputs, {
      description: `Usage: s install [command] [packageNames...] [-r|--runtime <runtime>] [-p|--package-type <type>] [--save] [-e|--env key=val ...]

        install dependencies for your project.`,
      commands: [{
        name: 'docker',
        desc: 'use docker to install dependencies.'
      }, {
        name: 'local',
        desc: 'install dependencies.'
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
      }, {
        name: '-c, --cmd <cmd>',
        desc: 'command with arguments to execute inside the installation docker.'
      }
      ]
    })

    const { Commands: commands = [], Parameters: parameters } = this.args(inputs.Args,
      ['i', 'interactive', 'save'],
      [],
      ['--cmd', '-c', '-e', '--env', '-f', '--file', '--save', '--url', '-p', '--package-type', '-r', '--runtime'])
    const { e, env, r, runtime, p, packageType, url, c, cmd, f, file, i, interactive, save } = parameters
    const installer = new Install()

    if (commands.length === 0) {
      console.log(red('input error, use \'s install --help\' for info.'))
      throw new Error('input error.')
    }

    const installCommand = commands[0]
    if (!_.includes(['docker', 'local'], installCommand)) {
      console.log(red(`Install command error, unknown subcommand '${installCommand}', use 's install --help' for info.`))
      throw new Error('Input error.')
    }

    // commands
    const useDocker = installCommand === 'docker'
    let installAll = true; let packages = []
    // console.log(commands);
    if (commands.length > 1) {
      packages = commands.slice(1)
      installAll = false
    }
    const cmdArgs = {
      env: [].concat(e).concat(env),
      runtime: r || runtime,
      packageType: p || packageType,
      registryUrl: url,
      cmd: c || cmd,
      interactive: i || interactive,
      save: save,
      fcFile: f || file || 'fcfile',
      url: url,
      installAll: installAll,
      packages: packages
    }

    if (!useDocker) {
      if (packages.length > 0 || cmdArgs.save || cmdArgs.packageType || cmdArgs.interactive || cmdArgs.cmd || cmdArgs.runtime) {
        console.log(red('\'local\' should be only used to install all dependencies in manifest, please use \'s install local\' without packageNames or params.'))
        throw new Error('Input error.')
      }
    }

    if (cmdArgs.interactive && cmdArgs.cmd) {
      console.log(red('\'--interactive\' should not be used with \'--cmd\''))
      throw new Error('Input error.')
    }

    if (installAll && (cmdArgs.save || cmdArgs.packageType || cmdArgs.url)) {
      console.log(red('Missing arguments [packageNames...], so --save|--package-type|--url option is ignored.'))
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
    } else {
      console.log('Start installing functions.')
      await installer.install({ serviceName, serviceProps: serviceInput, functionName, functionProps: functionInput, cmdArgs })
    }
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
    const {
      credentials,
      serviceName,
      serviceProp,
      functionName,
      functionProp,
      region
    } = this.handlerInputs(inputs)

    const { Commands: commands = [] } = this.args(inputs.Args)
    if (commands.length === 0) {
      console.log(red('input error, use \'s build --help\' for info.'))
      throw new Error('input error.')
    }
    const buildCommand = commands[0]
    if (!_.includes(['docker', 'local', 'image'], buildCommand)) {
      console.log(red(`Install command error, unknown subcommand '${buildCommand}', use 's build --help' for info.`))
      throw new Error('Input error.')
    }

    const builder = new Builder(credentials, region)
    const buildImage = buildCommand === 'image'
    if (buildImage) {
      if (functionProp.Runtime !== 'custom-container') {
        console.log(red(`'image' should only be used to build 'custom-container' project, your project is ${functionProp.Runtime}`))
        throw new Error('Input error.')
      }
      await builder.buildImage(serviceName, serviceProp, functionName, functionProp)
      return
    }

    // serviceName, serviceProps, functionName, functionProps, useDocker, verbose
    const useDocker = buildCommand === 'docker'
    if (useDocker) {
      console.log('Use docker for building.')
    }
    await builder.build(serviceName, serviceProp, functionName, functionProp, useDocker, true)

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
  async nas (inputs) {
    this.help(inputs, {
      description: `Usage: s nas [command] [options] [arguments]

      Operate NAS file system. Example:
      * s nas sync : sync directories and files to NAS configured in template.yaml.
      * s nas sync -n : sync directories and files to NAS without overwriting existed files.
      * s nas ls /mnt/auto : list NAS directories and files under the fc path bound.`,
      commands: [{
        name: 'sync',
        desc: 'synchronize the local directory to the remote NAS file system. Example:'
      }, {
        name: 'ls',
        desc: 'list contents of remote NAS directory.'
      }],
      args: [{
        name: '-n, --no-overwrite',
        desc: 'Never overwrite existing files on NAS when synchronizing files.'
      }, {
        name: '-a, --alias <alias>',
        desc: 'Synchronize to NAS with this alias.'
      }, {
        name: '--all',
        desc: 'Show all files as well as hidden directories and files.'
      }]
    })

    const { Commands: commands = [], Parameters: parameters } = this.args(inputs.Args,
      ['-n', '--no-overwrite', '-o', '--overwrite', '--all'],
      [],
      ['--alias', '-a', '-n', '--no-overwrite', '--all'])

    if (commands.length === 0) {
      console.log(red('input error, use \'s nas --help\' for info.'))
      throw new Error('input error.')
    }

    const nasCommand = commands[0]
    if (!_.includes(['sync', 'ls'], nasCommand)) {
      console.log(red(`Nas command error, unknown subcommand '${nasCommand}', use 's nas --help' for info.`))
      throw new Error('Input error.')
    }

    const cmdArgs = {
      alias: parameters.a || parameters.alias,
      noOverwirte: parameters.n || parameters.noOverwirte || false,
      all: parameters.all
    }

    const {
      credentials,
      serviceName,
      serviceProp,
      region
    } = this.handlerInputs(inputs)

    // TODO fix auto
    if (!serviceProp || !serviceProp.Nas) {
      console.log(red('No NAS config found in template.yaml'))
      throw new Error('input error.')
    }
    if (!serviceProp.Nas || serviceProp.Nas === 'Auto' || _.isEmpty(serviceProp.Nas.MountPoints)) {
      console.log(red('No \'MountPoints\' config found in your NAS config, please set MountPoints manully for sync.'))
      throw new Error('input error.')
    }

    console.log('Loading NAS component, this may cost a few minutes...')
    const nasComponent = await this.load('nas', 'Component')
    console.log('Load NAS component successfully.')

    // check function if exists
    const fcFunction = new FcFunction(credentials, region)
    const existsNasServerFunction = await fcFunction.functionExists(serviceName, 'fun-nas-function')
    if (!existsNasServerFunction) {
      console.log('Configuring a function for operating files on NAS: fun-nas-function.')
      await nasComponent.deploy(Object.assign({}, inputs))
      console.log('fun-nas-function is up')
    }

    const isSyncCommand = nasCommand === 'sync'
    const isLsCommand = nasCommand === 'ls'
    if (isSyncCommand) {
      let hadSync = false
      for (const mountPoint of serviceProp.Nas.MountPoints) {
        const localDir = mountPoint.LocalDir
        if (!localDir) {
          console.log(red('No \'LocalDir\' config found in your NAS mounpoint config.'))
          throw new Error('input error.')
        }
        const remoteDir = mountPoint.FcDir || mountPoint.MountDir
        if (!remoteDir) {
          console.log(red('No \'FcDir\' config found in your NAS mounpoint config.'))
          throw new Error('input error.')
        }
        if (cmdArgs.alias && cmdArgs.alias !== mountPoint.Alias) {
          continue
        }

        const nasComponentInputs = Object.assign({}, inputs)
        process.argv = ['node', 's', 'cp'] // TODO 修改nas组件，不需要这么处理
        if (cmdArgs.noOverwirte) {
          nasComponentInputs.Args = `-r -n ${localDir} nas://${remoteDir}`
        } else {
          nasComponentInputs.Args = `-r ${localDir} nas://${remoteDir}`
        }

        console.log(`Sync ${localDir} to remote ${remoteDir}`)
        await nasComponent.cp(nasComponentInputs)
        hadSync = true
      }
      if (!hadSync && cmdArgs.alias) {
        console.log(yellow('No files or directory sync to NAS, please check alias if correct.'))
      }
    } else if (isLsCommand) {
      let remoteDirs = []
      if (commands.length <= 1) {
        for (const mountPoint of serviceProp.Nas.MountPoints) {
          if (mountPoint.FcDir || mountPoint.MountDir) {
            remoteDirs.push(mountPoint.FcDir || mountPoint.MountDir)
          }
        }
      } else {
        remoteDirs = commands.slice(1)
      }

      for (const remoteDir of remoteDirs) {
        const nasComponentInputs = Object.assign({}, inputs)
        process.argv = ['node', 's', 'ls'] // TODO 修改nas组件，不需要这么处理
        if (cmdArgs.all) {
          nasComponentInputs.Args = `-a nas://${remoteDir}`
        } else {
          nasComponentInputs.Args = `nas://${remoteDir}`
        }

        console.log(yellow(`Now showing contents under remote directory ${remoteDir}:`))
        await nasComponent.ls(nasComponentInputs)
      }
    }
  }
}

module.exports = FcComponent
