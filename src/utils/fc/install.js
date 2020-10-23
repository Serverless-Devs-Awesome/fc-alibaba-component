const path = require('path')
const fs = require('fs-extra')
const fcBuilders = require('@alicloud/fc-builders')
const buildOpts = require('../build/build-opts')
const docker = require('../docker/docker')
const dockerOpts = require('../docker/docker-opts')
const _ = require('lodash')
const ncp = require('../ncp')
const util = require('util')
const ncpAsync = util.promisify(ncp)
const { processorTransformFactory } = require('../error/error-processor')
const { sboxForServerless } = require('../docker/sbox')
const { red } = require('colors')
const { resolveEnv } = require('../build/parser')
const { FunModule } = require('../install/module')
const parser = require('../build/parser')
const nas = require('../nas/nas')
const uuid = require('uuid')
const { DEFAULT_NAS_PATH_SUFFIX } = require('../tpl/tpl')
const Logger = require('../logger')

class Install {
  constructor (commands, parameters, { credentials, serviceName, serviceProp, functionName, functionProp, region }) {
    this.commands = commands
    this.parameters = parameters
    this.credentials = credentials
    this.serviceName = serviceName
    this.serviceProp = serviceProp
    this.functionName = functionName
    this.functionProp = functionProp
    this.region = region
    this.logger = new Logger()
  }

  async handle () {
    const { e, env, r, runtime, p, packageType, url, c, cmd, f, file, i, interactive, save } = this.parameters

    if (this.commands.length === 0) {
      throw new Error('Input error, use \'s install --help\' for info.')
    }

    const installCommand = this.commands[0]
    if (!_.includes(['docker', 'local'], installCommand)) {
      this.logger.error(`Install command error, unknown subcommand '${installCommand}', use 's install --help' for info.`)
      throw new Error('Input error.')
    }

    // commands
    const useDocker = installCommand === 'docker'
    let installAll = true; let packages = []
    if (this.commands.length > 1) {
      packages = this.commands.slice(1)
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
        this.logger.error('\'local\' should be only used to install all dependencies in manifest, please use \'s install docker\' if you need to install with packages or params.')
        throw new Error('Input error.')
      }
    }

    if (cmdArgs.interactive && cmdArgs.cmd) {
      this.logger.error('\'--interactive\' should not be used with \'--cmd\'')
      throw new Error('Input error.')
    }

    if (installAll && (cmdArgs.save || cmdArgs.packageType || cmdArgs.url)) {
      this.logger.warn('Missing arguments [packageNames...], so --save|--package-type|--url option is ignored.')
    }

    this.logger.info('Start to install dependency.')

    if (useDocker) {
      this.logger.info('Start installing functions using docker.')
      await this.installInDocker({
        serviceName: this.serviceName,
        serviceProps: this.serviceProp,
        functionName: this.functionName,
        functionProps: this.functionProp,
        cmdArgs
      })
    } else {
      this.logger.info('Start installing functions.')
      await this.install({
        serviceName: this.serviceName,
        serviceProps: this.serviceProp,
        functionName: this.functionName,
        functionProps: this.functionProp,
        cmdArgs
      })
    }
  }

  async install ({ serviceName, serviceProps, functionName, functionProps, cmdArgs = {} }) {
    const codeUri = functionProps.CodeUri
    const baseDir = process.cwd()
    const absCodeUri = path.resolve(baseDir, codeUri)
    const runtime = functionProps.Runtime
    // detect fcfile
    const fcfilePath = path.resolve(absCodeUri, 'fcfile')
    if (fs.existsSync(fcfilePath)) {
      this.logger.warn('Found fcfile in src directory, maybe you want to use \'s install docker\' ?')
    }

    const stages = ['install']
    const builder = new fcBuilders.Builder(serviceName, functionName, absCodeUri, runtime, absCodeUri, false, stages)
    await builder.build()
  }

  async installInteractiveInDocker (serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, isInteractive, cmd, envs) {
    const runtime = functionProps.Runtime
    const imageName = await dockerOpts.resolveRuntimeToDockerImage(runtime, true)
    const absCodeUri = path.resolve(baseDir, codeUri)
    let mounts = []
    const nasConfig = (serviceProps || {}).Nas // TODO nahai confirm the nas path
    mounts = await docker.resolveNasConfigToMounts(baseDir, serviceName, nasConfig, nas.getDefaultNasDir(baseDir))
    mounts.push(await docker.resolveCodeUriToMount(absCodeUri, false))
    mounts.push(await docker.resolvePasswdMount())

    await docker.pullImageIfNeed(imageName)
    await docker.startSboxContainer({
      runtime,
      imageName,
      mounts: _.compact(mounts),
      cmd,
      envs,
      isTty: (isInteractive && process.stdin.isTTY) || false,
      isInteractive
    })
  }

  // [ 'A=B', 'B=C' ] => { A: 'B', B: 'C' }
  // convertEnvs = (env) => (env || []).map(e => _.split(e, '=', 2))
  // .filter(e => e.length === 2)
  // .reduce((acc, cur) => (acc[cur[0]] = cur[1], acc), {});

  convertEnvs (env) {
    return (env || []).map(e => _.split(e, '=', 2)).filter(e => e.length === 2).reduce((acc, cur) => {
      acc[cur[0]] = cur[1]
      return acc
    }, {})
  }

  findAllTargetsFromTasks (tasks) {
    const targets = []
    for (const t of tasks) {
      const target = t.attrs.target

      if (target) {
        targets.push(target)
      }
    }

    return targets
  }

  /**
     * Docker 构建
     */
  async installInDocker ({ serviceName, serviceProps, functionName, functionProps, cmdArgs = {} }) {
    const verbose = false
    const codeUri = functionProps.CodeUri
    const baseDir = process.cwd()
    const artifactPath = path.resolve(baseDir, codeUri)
    const absCodeUri = path.resolve(baseDir, codeUri)
    const funcArtifactDir = artifactPath
    const runtime = cmdArgs.runtime || functionProps.Runtime
    const envs = this.convertEnvs(cmdArgs.env)
    const url = cmdArgs.url
    //, baseDir, codeUri, funcArtifactDir, verbose
    const stages = ['install']
    const nasProps = {}

    if (!cmdArgs.installAll) {
      await this.installPackageInDocker(cmdArgs.packages, {
        serviceName,
        serviceProps,
        functionName,
        functionProps,
        runtime,
        isInteractive: false,
        baseDir,
        absCodeUri,
        envs,
        save: cmdArgs.save,
        url,
        packageType: cmdArgs.packageType
      })
      return
    }

    if (cmdArgs.interactive || cmdArgs.cmd) {
      this.logger.info('Now entering docker environment for installing dependency.')
      // serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, isInteractive, cmd, envs
      await this.installInteractiveInDocker(serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, cmdArgs.interactive, cmdArgs.cmd, envs)
      return
    }

    let imageTag
    const funfilePath = path.resolve(absCodeUri, cmdArgs.fcFile)
    if (fs.existsSync(funfilePath)) {
      if (cmdArgs.runtime) {
        this.logger.warn('Found fcfile in your path, -r/--runtime will be ignored')
      }
      imageTag = await this.processFunfile(serviceName, serviceProps, codeUri, funfilePath, baseDir, funcArtifactDir, runtime, functionName)
    }

    const custom = {}
    if (cmdArgs.env) {
      custom.Env = this.convertEnvs(cmdArgs.env)
    }
    if (cmdArgs.runtime) {
      custom.Runtime = cmdArgs.runtime
    }
    const opts = await buildOpts.generateBuildContainerBuildOpts(serviceName,
      serviceProps,
      functionName,
      functionProps,
      nasProps,
      baseDir,
      absCodeUri,
      funcArtifactDir,
      verbose,
      imageTag,
      stages,
      custom)

    const usedImage = opts.Image
    if (!imageTag) {
      await docker.pullImageIfNeed(usedImage)
    }

    this.logger.info('\nbuild function using image: ' + usedImage)

    // todo: 1. create container, copy source code to container
    // todo: 2. build and then copy artifact output

    const errorTransform = processorTransformFactory({
      serviceName: serviceName,
      functionName: functionName,
      errorStream: process.stderr
    })

    const exitRs = await docker.run(opts, null, process.stdout, errorTransform)
    if (exitRs.StatusCode !== 0) {
      throw new Error(`build function ${serviceName}/${functionName} error`)
    }
  }

  async convertFunfileToDockerfile (funfilePath, dockerfilePath, runtime, serviceName, functionName) {
    const dockerfileContent = await parser.funfileToDockerfile(funfilePath, runtime, serviceName, functionName)

    await fs.writeFile(dockerfilePath, dockerfileContent)
  }

  async processFunfile (serviceName, serviceProps, codeUri, funfilePath, baseDir, funcArtifactDir, runtime, functionName) {
    const dockerfilePath = path.join(codeUri, '.Funfile.generated.dockerfile')
    await this.convertFunfileToDockerfile(funfilePath, dockerfilePath, runtime, serviceName, functionName)

    const nasConfig = (serviceProps || {}).Nas // TODO confirm Nas path
    let nasMappings
    if (nasConfig) {
      nasMappings = await nas.convertNasConfigToNasMappings(nas.getDefaultNasDir(baseDir), nasConfig, serviceName)
    }

    const tag = `fun-cache-${uuid.v4()}`
    const imageTag = await docker.buildImage(codeUri, dockerfilePath, tag)

    // copy fun install generated artifact files to artifact dir
    this.logger.info(`copying function artifact to ${funcArtifactDir}`)
    await docker.copyFromImage(imageTag, '/code/.', funcArtifactDir)

    // process nas folder
    await this.copyNasArtifact(nasMappings, imageTag, baseDir, funcArtifactDir)
    await fs.remove(dockerfilePath)

    return imageTag
  }

  async copyNasArtifact (nasMappings, imageTag, rootArtifactsDir, funcArtifactDir) {
    // if .fun/nas exist in funcArtifactDir , fun will move co rootartifactsDir
    const funcNasFolder = path.join(funcArtifactDir, DEFAULT_NAS_PATH_SUFFIX)
    const rootNasFolder = path.join(rootArtifactsDir, DEFAULT_NAS_PATH_SUFFIX)

    if (await fs.pathExists(funcNasFolder) && funcNasFolder !== rootNasFolder) {
      this.logger.info(`moving ${funcNasFolder} to ${rootNasFolder}`)

      await fs.ensureDir(rootNasFolder)

      await ncpAsync(funcNasFolder, rootNasFolder)
      await fs.remove(funcNasFolder)
    }

    if (nasMappings) {
      for (const nasMapping of nasMappings) {
        const localNasDir = nasMapping.localNasDir
        let remoteNasDir = nasMapping.remoteNasDir

        if (!remoteNasDir.endsWith('/')) {
          remoteNasDir += '/'
        }

        try {
          this.logger.info('copy from container ' + remoteNasDir + '.' + ' to localNasDir')
          await docker.copyFromImage(imageTag, remoteNasDir + '.', localNasDir)
        } catch (e) {
          this.logger.error(`copy from image ${imageTag} directory ${remoteNasDir} to ${localNasDir} error`)
          throw e
        }
      }
    }
  }

  async installPackageInDocker (packages, options = {}) {
    let pkgType = options.packageType
    if (!pkgType) {
      if (options.runtime.includes('nodejs')) {
        pkgType = 'npm'
      } else if (options.runtime.includes('python')) {
        pkgType = 'pip'
      } else {
        this.logger.warn(`please specify 'packageType', can't know packageType for current runtime: ${options.runtime}`)
        throw new Error('Unknown packageType.')
      }
    }

    for (const pkg of packages) {
      const cmd = this.convertPackageToCmd(pkgType === 'apt' ? 'apt-get' : pkgType, pkg, options.url)
      options.cmd = cmd

      await sboxForServerless(options)
    }

    if (options.save) {
      await this.save(options.runtime, options.absCodeUri, pkgType, packages, options.envs)
    }
  }

  async getCodeUri (functionRes) {
    if (functionRes) {
      if (functionRes.Properties && functionRes.Properties.CodeUri) {
        return path.resolve(functionRes.Properties.CodeUri)
      }
      throw new Error('Error: can not find CodeUri in function')
    }
    return process.cwd()
  }

  getRuntime (codeUri, functionRes, options) {
    let moduleRuntime

    if (fs.existsSync(path.join(codeUri, 'fun.yml'))) {
      moduleRuntime = FunModule.load(path.join(codeUri, 'fun.yml')).runtime
    }

    if (options.runtime) {
      if (moduleRuntime && options.runtime !== moduleRuntime) {
        throw new Error(red(`'${options.runtime}' specified by --runtime option doesn't match the one in fun.yml.`))
      }
      return options.runtime
    } else if (options.function) {
      if (functionRes && functionRes.Properties && functionRes.Properties.Runtime) {
        if (moduleRuntime) {
          if (functionRes.Properties.Runtime !== moduleRuntime) {
            throw new Error(red('\'runtime\' in template.yml and fun.yml is not equal'))
          }
        }
        return functionRes.Properties.Runtime
      }
    } else if (moduleRuntime) {
      return moduleRuntime
    }
    throw new Error(red('\'runtime\' is missing, you should specify it by --runtime option.'))
  }

  async save (runtime, codeUri, pkgType, packages, env) {
    let funfilePath = await this.getOrConvertFcfile(codeUri)
    const cmds = []

    if (!funfilePath) {
      funfilePath = path.join(codeUri, 'fcfile')
      cmds.push(`RUNTIME ${runtime}`)
    }

    let resolvedEnv = resolveEnv(env).join(' ')
    if (!_.isEmpty(resolvedEnv)) {
      resolvedEnv = ' ' + resolvedEnv
    }

    this.logger.info(`\nsave package install commnad to ${funfilePath}`)

    for (const pkg of packages) {
      const cmd = await this.convertPackageToCmd(pkgType === 'apt' ? 'apt-get' : pkgType, pkg)
      cmds.push(`RUN${resolvedEnv} ${cmd}`)
    }

    await fs.appendFile(funfilePath, `\n${cmds.join('\n')}\n`)
  }

  validateRegistry (runtime, options) {
    if (options.indexUrl && options.registry) {
      throw new Error('\'--index-url\' and \'--registry\' cannot be specified together.')
    }

    if (options.indexUrl && !(runtime.indexOf('python') > -1)) {
      throw new Error(`'--index-url' needs to be used with '--runtime' python2.7/python3.6, and you are currently using ${runtime}`)
    }

    if (options.registry && !(runtime.indexOf('node') > -1)) {
      throw new Error(`'--registry' needs to be used with '--runtime' nodejs6/nodejs8/nodejs10/nodejs12, and you are currently using ${runtime}`)
    }
  }

  convertPackageToCmd (pkgType, pkg, url) {
    if (!_.includes(['pip', 'npm', 'apt-get'], pkgType)) {
      throw new Error(`unknow package type %${pkgType}`)
    }

    const defaultCmd = `fun-install ${pkgType} install ${pkg}`

    if (pkgType === 'npm' && url) {
      return `${defaultCmd} --registry ${url}`
    }

    if (pkgType === 'pip' && url) {
      return `${defaultCmd} --index-url ${url}`
    }

    return defaultCmd
  }

  async getOrConvertFcfile (codeUri) {
    const funfilePath = path.join(codeUri, 'fcfile')
    const funfileExist = await fs.pathExists(funfilePath)
    if (funfileExist) {
      return funfilePath
    }
    return null
  }
}

module.exports = Install
