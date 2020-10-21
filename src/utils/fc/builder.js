'use strict'

const path = require('path')
const fs = require('fs-extra')
const fcBuilders = require('@alicloud/fc-builders')
const buildOpts = require('../build/build-opts')
const docker = require('../docker/docker')
const _ = require('lodash')
const ncp = require('../ncp')
const util = require('util')
const ncpAsync = util.promisify(ncp)
const { processorTransformFactory } = require('../error/error-processor')
const Install = require('./install')
const Logger = require('../logger')
const execSync = require('child_process').execSync

class Builder {
  constructor (commands = {}, parameters = {}, {
    credentials = {},
    serviceName = '',
    serviceProp = {},
    functionName = '',
    functionProp = {},
    region = ''
  } = {}) {
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
    if (this.commands.length === 0) {
      throw new Error('Input error, use \'s build --help\' for info.')
    }
    const buildCommand = this.commands[0]
    if (!_.includes(['docker', 'local', 'image'], buildCommand)) {
      throw new Error(`Install command error, unknown subcommand '${buildCommand}', use 's build --help' for info.`)
    }

    const buildImage = buildCommand === 'image'
    if (buildImage) {
      if (this.functionProp.Runtime !== 'custom-container') {
        throw new Error(`'image' should only be used to build 'custom-container' project, your project is ${this.functionProp.Runtime}`)
      }
      await this.buildImage(this.serviceName, this.serviceProp, this.functionName, this.functionProp)
      return
    }

    // serviceName, serviceProps, functionName, functionProps, useDocker, verbose
    const useDocker = buildCommand === 'docker'
    if (useDocker) {
      this.logger.info('Use docker for building.')
    }
    await this.build(this.serviceName, this.serviceProp, this.functionName, this.functionProp, useDocker, true)

    this.logger.success('Build artifact successfully.')
  }

  // constructor (credentials, region) {
  //   this.credentials = credentials
  //   this.region = region
  // }

  async build (serviceName, serviceProps, functionName, functionProps, useDocker, verbose) {
    const codeUri = functionProps.CodeUri
    const baseDir = process.cwd()
    const runtime = functionProps.Runtime

    if (!await this.codeNeedBuild(baseDir, codeUri, runtime)) {
      return
    }

    this.initBuildCodeDir(baseDir, serviceName, functionName)
    this.initBuildArtifactDir(baseDir, serviceName, functionName)
    const artifactPath = this.getArtifactPath(baseDir, serviceName, functionName)
    await this.copyCodeForBuild(baseDir, codeUri, serviceName, functionName)

    if (useDocker) {
      // serviceName, serviceProps, functionName, functionProps, codePath, artifactPath, verbose
      const codeRelativePath = this.getBuildCodeRelativePath(serviceName, functionName)
      await this.buildInDocker(serviceName, serviceProps, functionName, functionProps, baseDir, codeRelativePath, artifactPath, verbose)
    } else {
      const codePath = this.getBuildCodeAbsPath(baseDir, serviceName, functionName)
      await this.buildArtifact(serviceName, serviceProps, functionName, functionProps, codePath, artifactPath, verbose)
    }

    // await this.collectArtifact(functionProps.Runtime, artifactPath)
  }

  async buildInDocker (serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, funcArtifactDir, verbose) {
    const stages = ['install', 'build']
    const nasProps = {}
    const runtime = functionProps.Runtime

    let imageTag
    const funfilePath = path.resolve(baseDir, codeUri, 'fcfile')
    if (fs.existsSync(funfilePath)) {
      this.logger.info('Found fcfile in your codrUri directory.')
      const installer = new Install()
      imageTag = await installer.processFunfile(serviceName, serviceProps, codeUri, funfilePath, baseDir, funcArtifactDir, runtime, functionName)
    }

    const opts = await buildOpts.generateBuildContainerBuildOpts(serviceName,
      serviceProps,
      functionName,
      functionProps,
      nasProps,
      baseDir,
      codeUri,
      funcArtifactDir,
      verbose,
      imageTag,
      stages)

    const usedImage = opts.Image

    if (!imageTag) {
      await docker.pullImageIfNeed(usedImage)
    }
    this.logger.info('\nBuild function using image: ' + usedImage)

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

  async buildArtifact (serviceName, serviceProps, functionName, functionProps, codePath, artifactPath, verbose) {
    const stages = ['install', 'build']
    const runtime = functionProps.Runtime

    // detect fcfile
    const fcfilePath = path.resolve(codePath, 'fcfile')
    if (fs.existsSync(fcfilePath)) {
      this.logger.warn('Found fcfile in src directory, maybe you want to use \'s build docker\' ?')
    }
    const builder = new fcBuilders.Builder(serviceName, functionName, codePath, runtime, artifactPath, verbose, stages)
    await builder.build()
  }

  async buildImage (serviceName, serviceProps, functionName, functionProps) {
    const customContainer = functionProps.CustomContainer
    if (!customContainer) {
      throw new Error('No \'CustomContainer\' configuration found in template.yml.')
    }
    let dockerFile = 'Dockerfile'
    if (customContainer && customContainer.Dockerfile) {
      dockerFile = customContainer.Dockerfile
    }
    let imageName = customContainer.Image
    // TODO duplicated code in deploy, use a better way to handle this
    if (!imageName) {
      imageName = this.getDefaultImageName(this.region, serviceName, functionName)
    }

    if (!fs.existsSync(dockerFile)) {
      throw new Error('No dockerfile found.')
    }

    try {
      this.logger.info('Building image...')
      execSync(`docker build -t ${imageName} -f ${dockerFile} .`, {
        stdio: 'inherit'
      })
      this.logger.success(`Build image(${imageName}) successfully`)
    } catch (e) {
      this.logger.error(e.message)
      throw e
    }
  }

  initBuildCodeDir (baseDir, serviceName, functionName) {
    const codePath = this.getBuildCodeAbsPath(baseDir, serviceName, functionName)
    if (fs.pathExistsSync(codePath)) {
      fs.rmdirSync(codePath, { recursive: true })
    }
    fs.mkdirpSync(codePath)
  }

  initBuildArtifactDir (baseDir, serviceName, functionName) {
    const artifactPath = this.getArtifactPath(baseDir, serviceName, functionName)
    if (fs.pathExistsSync(artifactPath)) {
      fs.rmdirSync(artifactPath, { recursive: true })
    }
    fs.mkdirpSync(artifactPath)
  }

  isOnlyDefaultTaskFlow (taskFlows) {
    if (taskFlows.length !== 1) { return false }

    return taskFlows[0].name === 'DefaultTaskFlow'
  }

  runtimeMustBuild (runtime) {
    if (!runtime || typeof runtime !== 'string') {
      return false
    }
    return runtime.includes('java')
  }

  async codeNeedBuild (baseDir, codeUri, runtime) {
    // check codeUri
    if (!codeUri) {
      this.logger.info('No code uri configured, skip building.')
      return false
    }
    if (typeof codeUri === 'string') {
      if (codeUri.endsWith('.zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war')) {
        this.logger.info('Artifact configured, skip building.')
        return false
      }
    } else {
      if (!codeUri.Src) {
        this.logger.info('No Src configured, skip building.')
        return false
      }
      if (codeUri.Src.endsWith('.zip') || codeUri.Src.endsWith('.jar') || codeUri.Src.endsWith('.war')) {
        this.logger.info('Artifact configured, skip building.')
        return false
      }
    }

    const Builder = fcBuilders.Builder
    const absCodeUri = path.resolve(baseDir, codeUri)
    const taskFlows = await Builder.detectTaskFlow(runtime, absCodeUri)
    if (_.isEmpty(taskFlows) || this.isOnlyDefaultTaskFlow(taskFlows)) {
      this.logger.info('No need build for this project.')
      if (runtime === 'custom-container') {
        this.logger.warn('This is a custom-container project, maybe you want to use \'s build image\'?')
      }
      return false
    }
    return true
  }

  async copyCodeForBuild (baseDir, codeUri, serviceName, functionName) {
    const absCodeUri = path.resolve(baseDir, codeUri)
    const buildCodePath = this.getBuildCodeAbsPath(baseDir, serviceName, functionName)
    try {
      await ncpAsync(absCodeUri, buildCodePath, {
        filter: (source) => {
          if (source.endsWith('.s') || source.endsWith('.fc') || source.endsWith('.git') ||
                source === 'vendor' || source === 'node_modules') {
            return false
          }
          return true
        }
      })
    } catch (e) {
      this.logger.error(e.message)
    }
  }

  codeUriCanBuild (codeUri) {
    if (!codeUri) {
      this.logger.info('No code uri configured, skip building.')
      return false
    }

    if (typeof codeUri === 'string') {
      if (codeUri.endsWith('.zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war')) {
        this.logger.info('Artifact configured, skip building.')
        return false
      }
    } else {
      if (!codeUri.Src) {
        this.logger.info('No Src configured, skip building.')
        return false
      }
      if (codeUri.Src.endsWith('.zip') || codeUri.Src.endsWith('.jar') || codeUri.Src.endsWith('.war')) {
        this.logger.info('Artifact configured, skip building.')
        return false
      }
    }

    return true
  }

  hasBuild (baseDir, serviceName, functionName) {
    const artifactPath = this.getArtifactPath(baseDir, serviceName, functionName)
    // TODO check if modified after last build
    return fs.pathExistsSync(artifactPath)
  }

  getArtifactPath (baseDir, serviceName, functionName) {
    const rootArtifact = path.join(baseDir, '.fc', 'build', 'artifacts')
    return path.join(rootArtifact, serviceName, functionName)
  }

  getBuildCodeAbsPath (baseDir, serviceName, functionName) {
    return path.join(baseDir, this.getBuildCodeRelativePath(serviceName, functionName))
  }

  getBuildCodeRelativePath (serviceName, functionName) {
    return path.join('.fc', 'build', 'code', serviceName, functionName)
  }

  getDefaultImageName (regionId, serviceName, functionName) {
    const defaultNamespace = this.getDefaultNamespace()
    const defaultRepo = this.getDefaultRepo(serviceName, functionName)
    const defaultRegistry = this.getDefaultRegistry(regionId)
    return `${defaultRegistry}/${defaultNamespace}/${defaultRepo}:latest`
  }

  getDefaultNamespace () {
    return `fc-${this.credentials.AccountID}`
  }

  getDefaultRepo (serviceName, functionName) {
    return `${serviceName}-${functionName}`.toLocaleLowerCase()
  }

  getDefaultRegistry (regionId) {
    return `registry.${regionId}.aliyuncs.com`
  }
}

module.exports = Builder
