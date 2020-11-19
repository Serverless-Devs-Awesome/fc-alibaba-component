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
      throw new Error('Input error, use \'s nas --help\' for info.')
    }

    const nasCommand = this.commands[0]
    const isSyncCommand = nasCommand === 'sync'
    const isLsCommand = nasCommand === 'ls'
    const isRmCommand = nasCommand === 'rm'
    if (!isSyncCommand && !isLsCommand && !isRmCommand) {
      this.logger.error(`Nas command error, unknown subcommand '${nasCommand}', use 's nas --help' for info.`)
      throw new Error('Input error.')
    }

    const cmdArgs = {
      alias: this.parameters.alias,
      noOverwirte: this.parameters.n || this.parameters.noOverwirte || false,
      all: this.parameters.a || this.parameters.all,
      force: this.parameters.f || this.parameters.force,
      recursive: this.parameters.r || this.parameters.recursive
    }

    // TODO fix auto
    if (!this.serviceProp || !this.serviceProp.Nas) {
      this.logger.error('No nas config found in template.yaml')
      throw new Error('Input error.')
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
      /**      let remoteDirs = []
      if (this.commands.length <= 1) {
        remoteDirs = remoteDirs.concat(this.getRemoteFcDirFromServiceProp())
      } else {
        remoteDirs = this.commands.slice(1)
      } */
      const syncLocalDirs = this.commands.slice(1)
      if (_.isEmpty(syncLocalDirs) && _.isEmpty(this.serviceProp.Nas.LocalDir) && _.isEmpty(this.serviceProp.Nas.MountPoints)) {
        this.logger.error('No local directory found in command line and temlate file, example: s nas sync <local dir>')
        throw new Error('Input error.')
      }
      if (this.serviceProp.Nas === 'Auto' || this.serviceProp.Nas.Type === 'Auto') {
        await this.syncAuto(cmdArgs.noOverwirte, syncLocalDirs, this.serviceProp.Nas.FcDir)
      } else {
        await this.syncNonAuto(cmdArgs.alias, cmdArgs.noOverwirte, syncLocalDirs)
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
    } else if (isRmCommand) {
      if (this.commands.length <= 1) {
        throw new Error('Please input fc dir, use \'s nas --help\' for more info')
      }
      const fcDirs = this.commands.slice(1)
      fcDirs.forEach(function(element, index, arr) {
        if (!element.startsWith("nas://")) {
          arr[index] = "nas://" + element;
        }
      });
      const nasComponentInputs = Object.assign({}, this.inputs)
      process.argv = ['node', 's', 'rm']
      nasComponentInputs.Args = fcDirs.join(' ')
      if (cmdArgs.force) {
        nasComponentInputs.Args = '-f ' + nasComponentInputs.Args
      }
      if (cmdArgs.recursive) {
        nasComponentInputs.Args = '-r ' + nasComponentInputs.Args
      }
      this.logger.info(`Try to delete ${fcDirs} use nas component`)
      await this.nasComponent.rm(nasComponentInputs)
      this.logger.success('Delete successfully')
    }
  }

  /**
   * sync for 'Nas: Auto'
   */
  async syncAuto (noOverwirte, localDirs, remoteDir = undefined) {
    const nasComponentInputs = Object.assign({}, this.inputs)
    process.argv = ['node', 's', 'cp']
    remoteDir = remoteDir || FUN_AUTO_FC_MOUNT_DIR

    for (const localDir of localDirs) {
      this.logger.info(`Sync ${localDir} to remote ${remoteDir}`)
      if (noOverwirte) {
        nasComponentInputs.Args = `-r -n ${localDir} nas://${remoteDir}`
      } else {
        nasComponentInputs.Args = `-r ${localDir} nas://${remoteDir}`
      }
      await this.nasComponent.cp(nasComponentInputs)
    }
  }

  async syncNonAuto(alias, noOverwirte, localDirs) {
    let hadSync = false

    if (!_.isEmpty(localDirs)) {
      for (const localDir of localDirs) {
        for (const mountPoint of this.serviceProp.Nas.MountPoints) {
          const remoteDir = mountPoint.FcDir || mountPoint.MountDir
          if (!remoteDir) {
            this.logger.error('No \'FcDir\' config found in your nas mounpoint config.')
            throw new Error('Input error.')
          }
          if (alias && alias !== mountPoint.Alias) {
            continue
          }

          const nasComponentInputs = Object.assign({}, this.inputs)
          process.argv = ['node', 's', 'cp']
          if (noOverwirte) {
            nasComponentInputs.Args = `-r -n ${localDir} nas://${remoteDir}`
          } else {
            nasComponentInputs.Args = `-r ${localDir} nas://${remoteDir}`
          }

          this.logger.info(`Sync ${localDir} to remote ${remoteDir}`)
          await this.nasComponent.cp(nasComponentInputs)
          hadSync = true
        }
      }
      return
    } else {
      for (const mountPoint of this.serviceProp.Nas.MountPoints) {
        const localDir = mountPoint.LocalDir
        if (!localDir) {
          this.logger.error('No \'LocalDir\' config found in command line and template file, example: s nas sync <local_dir>.')
          throw new Error('Input error.')
        }
        const remoteDir = mountPoint.FcDir || mountPoint.MountDir
        if (!remoteDir) {
          this.logger.error('No \'FcDir\' config found in your nas mounpoint config.')
          throw new Error('Input error.')
        }
        if (alias && alias !== mountPoint.Alias) {
          continue
        }

        const nasComponentInputs = Object.assign({}, this.inputs)
        process.argv = ['node', 's', 'cp']
        if (typeof localDir === 'string') {
          if (noOverwirte) {
            nasComponentInputs.Args = `-r -n ${localDir} nas://${remoteDir}`
          } else {
            nasComponentInputs.Args = `-r ${localDir} nas://${remoteDir}`
          }

          this.logger.info(`Sync ${localDir} to remote ${remoteDir}`)
          await this.nasComponent.cp(nasComponentInputs)
        } else if (localDir instanceof Array) {
          for (const d of localDir) {
            if (noOverwirte) {
              nasComponentInputs.Args = `-r -n ${d} nas://${remoteDir}`
            } else {
              nasComponentInputs.Args = `-r ${d} nas://${remoteDir}`
            }

            this.logger.info(`Sync ${d} to remote ${remoteDir}`)
            await this.nasComponent.cp(nasComponentInputs)
          }
        }

        hadSync = true
      }
    }

    if (!hadSync && cmdArgs.alias) {
      this.logger.warn('No files or directory sync to NAS, please check alias if correct.')
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
