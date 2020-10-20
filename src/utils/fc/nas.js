const FcFunction = require('./function')
const { FUN_NAS_FUNCTION, FUN_AUTO_FC_MOUNT_DIR } = require('../nas/nas')
const _ = require('lodash')
const Logger = require('../logger')

class Nas {
  constructor (commands, parameters, { credentials, serviceName, serviceProp, region, nasComponent, inputs }) {
    this.commands = commands
    this.parameters = parameters
    this.credentials = credentials
    this.serviceName = serviceName
    this.serviceProp = serviceProp
    this.region = region
    this.nasComponent = nasComponent
    this.inputs = inputs
    this.logger = new Logger()
  }

  async handle () {
    if (this.commands.length === 0) {
      this.logger.error('Input error, use \'s nas --help\' for info.')
      throw new Error('Input error.')
    }

    const nasCommand = this.commands[0]
    const isSyncCommand = nasCommand === 'sync'
    const isLsCommand = nasCommand === 'ls'
    if (!isSyncCommand && !isLsCommand) {
      this.logger.error(`Nas command error, unknown subcommand '${nasCommand}', use 's nas --help' for info.`)
      throw new Error('Input error.')
    }

    const cmdArgs = {
      alias: this.parameters.a || this.parameters.alias,
      noOverwirte: this.parameters.n || this.parameters.noOverwirte || false,
      all: this.parameters.all
    }

    // TODO fix auto
    if (!this.serviceProp || !this.serviceProp.Nas) {
      this.logger.error('No nas config found in template.yaml')
      throw new Error('Input error.')
    }
    if (isSyncCommand) {
      if (!this.serviceProp.Nas || this.serviceProp.Nas === 'Auto' || _.isEmpty(this.serviceProp.Nas.MountPoints)) {
        this.logger.error('No \'MountPoints\' config found in your nas config, please set MountPoints manully for sync.')
        throw new Error('Input error.')
      }
    }

    // check function if exists
    const fcFunction = new FcFunction(this.credentials, this.region)
    const existsNasServerFunction = await fcFunction.functionExists(this.serviceName, FUN_NAS_FUNCTION)
    if (!existsNasServerFunction) {
      this.logger.info(`Configuring a function for operating files on NAS: ${FUN_NAS_FUNCTION}.`)
      const nasDeployInputs = Object.assign({}, this.inputs)
      process.argv = ['node', 's', 'deploy']
      nasDeployInputs.Args = 'function trigger' // only deploy function and trigger
      await this.nasComponent.deploy(nasDeployInputs)
    }

    if (isSyncCommand) {
      let hadSync = false
      for (const mountPoint of this.serviceProp.Nas.MountPoints) {
        const localDir = mountPoint.LocalDir
        if (!localDir) {
          this.logger.error('No \'LocalDir\' config found in your nas mounpoint config.')
          throw new Error('Input error.')
        }
        const remoteDir = mountPoint.FcDir || mountPoint.MountDir
        if (!remoteDir) {
          this.logger.error('No \'FcDir\' config found in your nas mounpoint config.')
          throw new Error('Input error.')
        }
        if (cmdArgs.alias && cmdArgs.alias !== mountPoint.Alias) {
          continue
        }

        const nasComponentInputs = Object.assign({}, this.inputs)
        process.argv = ['node', 's', 'cp']
        if (cmdArgs.noOverwirte) {
          nasComponentInputs.Args = `-r -n ${localDir} nas://${remoteDir}`
        } else {
          nasComponentInputs.Args = `-r ${localDir} nas://${remoteDir}`
        }

        this.logger.info(`Sync ${localDir} to remote ${remoteDir}`)
        await this.nasComponent.cp(nasComponentInputs)
        hadSync = true
      }
      if (!hadSync && cmdArgs.alias) {
        this.logger.warn('No files or directory sync to NAS, please check alias if correct.')
      }
    } else if (isLsCommand) {
      let remoteDirs = []
      if (this.commands.length <= 1) {
        remoteDirs = remoteDirs.concat(this.getRemoteFcDirFromServiceProp())
      } else {
        remoteDirs = this.commands.slice(1)
      }

      for (const remoteDir of remoteDirs) {
        const nasComponentInputs = Object.assign({}, this.inputs)
        process.argv = ['node', 's', 'ls'] // TODO 修改nas组件，不需要这么处理
        if (cmdArgs.all) {
          nasComponentInputs.Args = `-a nas://${remoteDir}`
        } else {
          nasComponentInputs.Args = `nas://${remoteDir}`
        }

        this.logger.warn(`Now showing contents under remote directory ${remoteDir}:`)
        await this.nasComponent.ls(nasComponentInputs)
      }
    }
  }

  getRemoteFcDirFromServiceProp () {
    const remoteDirs = []
    if (this.serviceProp.Nas === 'Auto') {
      remoteDirs.push(FUN_AUTO_FC_MOUNT_DIR)
      return remoteDirs
    }

    for (const mountPoint of this.serviceProp.Nas.MountPoints) {
      if (mountPoint.FcDir || mountPoint.MountDir) {
        remoteDirs.push(mountPoint.FcDir || mountPoint.MountDir)
      }
    }

    return remoteDirs
  }
}

module.exports = Nas
