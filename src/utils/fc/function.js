'use strict'

const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')

const util = require('util')
const ncp = require('../ncp')
const moment = require('moment')
const ncpAsync = util.promisify(ncp)
const AliyunContainerRepository = require('../cr')
const _ = require('lodash')

const OSS = require('../oss')
const Client = require('./client')
const Builder = require('./builder')

const { DEFAULT } = require('./static')
const { packTo } = require('@serverless-devs/s-zip')
const { execSync } = require('child_process')
const { addEnv } = require('../install/env')
const Logger = require('../logger')

class Function extends Client {
  constructor (credentials, region) {
    super(credentials, region)
    this.fcClient = this.buildFcClient()
    this.builder = new Builder({}, {}, { credentials, region })
    this.logger = new Logger()
  }

  async makeCacheDir (path) {
    if (!(await fs.existsSync(path))) {
      await fs.mkdirSync(path)
    }
  }

  getNasLocalConfig ({ Nas: nas }) {
    if (!nas || typeof nas === 'string' ) {
      return []
    }

    if (nas.Type) {
      if (nas.LocalDir) {
        return [].concat(nas.LocalDir)
      }
      return [];
    }
    let localDirs = [];
    if (nas.MountPoints) {
      nas.MountPoints.forEach(({ LocalDir: localDir }) => {
        localDirs = localDirs.concat(localDir)
      })
    }
    return localDirs;
  }

  async getFunctionCode (baseDir, serviceName, functionName, runtime, code, projectName, serviceInput) {
    const cachePath = path.join(process.cwd(), '.s', 'cache')
    const zipPath = path.join(cachePath, `${projectName}.zip`)
    const singlePathConfigued = typeof code === 'string'
    const codeUri = singlePathConfigued ? code : code.Src
    const artifactConfigured = codeUri && (codeUri.endsWith('.zip') || codeUri.endsWith('.s-zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war'))

    if (!singlePathConfigued && !code.Src) {
      if (code.Bucket && code.Object) {
        return {
          ossBucketName: code.Bucket,
          ossObjectName: code.Object
        }
      } else {
        throw new Error('CodeUri configuration does not meet expectations.')
      }
    }

    // generate the target artifact
    if (artifactConfigured) {
      const srcPath = path.resolve(code)
      const destPath = path.resolve(zipPath)
      if (srcPath !== destPath) {
        await fse.copy(srcPath, destPath)
      }
    } else {
      const nasLocalConfig = this.getNasLocalConfig(serviceInput)
      if (!_.isEmpty(nasLocalConfig)) {
        this.logger.warn(`Nas local dir(s) is configured, this will be ignored in deploy code to function`)
      }
      const packToParame = {
        outputFilePath: cachePath,
        outputFileName: `${projectName}.zip`,
        exclude: ['.s'].concat(nasLocalConfig),
        include: []
      }
      if (singlePathConfigued) {
        packToParame.codeUri = code
      } else {
        packToParame.codeUri = code.Src
        packToParame.exclude = packToParame.exclude.concat(code.Excludes || [])
        packToParame.include = packToParame.include.concat(code.Includes || [])
      }

      const buildArtifactPath = this.builder.getArtifactPath(baseDir, serviceName, functionName)
      if (packToParame.codeUri && this.builder.runtimeMustBuild(runtime)) {
        if (!this.builder.hasBuild(baseDir, serviceName, functionName)) {
          throw new Error("You need to build artifact with 's build' before you deploy.")
        }
        packToParame.codeUri = buildArtifactPath
      } else if (packToParame.codeUri && fs.existsSync(buildArtifactPath)) {
        // has execute build before, copy code to build artifact path and zip
        this.logger.info(`Found build artifact directory: ${buildArtifactPath}, now composing your code and dependencies with those built before.`)
        await ncpAsync(packToParame.codeUri, buildArtifactPath, {
          filter: (source) => {
            if (source.endsWith('.s') || source.endsWith('.fc') || source.endsWith('.git')) {
              return false
            }
            return true
          }
        })
        packToParame.codeUri = buildArtifactPath
      }

      if (packToParame.codeUri) {
        const test = await packTo(packToParame)
        if (!test.count) {
          throw new Error('Zip file error')
        }
      }
    }

    if (singlePathConfigued || (!singlePathConfigued && !code.Bucket)) {
      // artifact configured
      const data = await fs.readFileSync(zipPath)
      return {
        zipFile: Buffer.from(data).toString('base64')
      }
    } else {
      const oss = new OSS(this.credentials, `oss-${this.region}`, code.Bucket)
      const object = `${projectName}-${moment().format('YYYY-MM-DD')}.zip`
      await oss.uploadFile(zipPath, object)
      return {
        ossBucketName: code.Bucket,
        ossObjectName: object
      }
    }
  }

  /**
   * Delete function
   * @param {*} serviceName
   * @param {*} functionName
   */
  async remove (serviceName, functionName) {
    try {
      this.logger.info(`Deleting function ${serviceName}@${functionName}`)
      await this.fcClient.deleteFunction(serviceName, functionName)
      this.logger.success(`Delete function ${serviceName}@${functionName} successfully`)
    } catch (err) {
      if (err.code === 'ServiceNotFound') {
        this.logger.info('Service not exists, skip deleting function')
        return
      }
      if (err.code === 'FunctionNotFound') {
        this.logger.info(`Function ${serviceName}@${functionName} not exists.`)
      } else {
        throw new Error(`Unable to delete function ${serviceName}@${functionName}: ${err.message}`)
      }
    }
  }

  handlerConfig (functionInput) {
    const functionProperties = {
      functionName: functionInput.Name,
      description: functionInput.Description,
      runtime: functionInput.Runtime
    }

    functionProperties.handler = functionInput.Handler ? functionInput.Handler : DEFAULT.Handler

    const isCustomOrContainer = _.includes(['custom-container', 'custom'], functionProperties.runtime)
    if (isCustomOrContainer && functionInput.CAPort) {
      functionProperties.CAPort = functionInput.CAPort
    }
    if (functionInput.MemorySize) {
      functionProperties.memorySize = functionInput.MemorySize
    }
    if (functionInput.Timeout) {
      functionProperties.timeout = functionInput.Timeout
    }
    if (functionInput.Initializer && functionInput.Initializer.Handler) {
      functionProperties.initializer = functionInput.Initializer.Handler
    }
    if (functionInput.Initializer && functionInput.Initializer.Timeout) {
      functionProperties.initializationTimeout = functionInput.Initializer.Timeout
    }
    if (functionInput.InstanceConcurrency) {
      functionProperties.instanceConcurrency = functionInput.InstanceConcurrency
    }
    if (functionInput.Environment) {
      const EnvironmentAttr = {}
      for (let i = 0; i < functionInput.Environment.length; i++) {
        EnvironmentAttr[functionInput.Environment[i].Key] = functionInput.Environment[i].Value
      }
      functionProperties.environmentVariables = EnvironmentAttr
    }

    // Add env
    functionProperties.environmentVariables = addEnv(functionProperties.environmentVariables, undefined)// TODO nahai handle nas

    return functionProperties
  }

  async handlerCode (serviceInput, functionInput, serviceName, projectName) {
    const functionProperties = {}

    const deployContainerFunction = functionInput.Runtime === 'custom-container'
    if (deployContainerFunction) {
      if (!functionInput.CustomContainer) {
        throw new Error('No CustomContainer found for container runtime')
      }
      const customContainer = functionInput.CustomContainer
      let imageName = customContainer.Image
      const crAccount = customContainer.CrAccount || {}
      imageName = await this.pushImage(serviceName, functionInput.Name, crAccount.User, crAccount.Password, customContainer.Image)

      // code和customContainerConfig不能同时存在
      functionProperties.code = undefined
      functionProperties.customContainerConfig = {
        image: imageName
      }
      if (functionInput.CustomContainer.Command) {
        functionProperties.customContainerConfig.command = functionInput.CustomContainer.Command
      }
      if (functionInput.CustomContainer.Args) {
        functionProperties.customContainerConfig.args = functionInput.CustomContainer.Args
      }
    } else {
      const baseDir = process.cwd()
      const functionName = functionInput.Name
      const runtime = functionInput.Runtime
      const codeUri = functionInput.CodeUri
      functionProperties.code = await this.getFunctionCode(baseDir, serviceName, functionName, runtime, codeUri, projectName, serviceInput)
      // functionProperties.code = await this.getFunctionCode(functionInput.CodeUri, projectName)
    }
    return functionProperties
  }

  async functionExists (serviceName, functionName) {
    try {
      await this.fcClient.getFunction(serviceName, functionName)
      return true
    } catch (e) {
      // TODO more accurate
      return false
    }
  }

  async deploy ({
    projectName,
    serviceName, serviceProp,
    functionName, functionProp,
    onlyDelpoyConfig, onlyDelpoyCode
  }) {
    functionProp.Runtime = functionProp.Runtime ? functionProp.Runtime : DEFAULT.Runtime
    let functionProperties
    if (onlyDelpoyConfig) {
      this.logger.info('Only deploy function config.')
      functionProperties = this.handlerConfig(functionProp)
    } else if (onlyDelpoyCode) {
      this.logger.info('Only deploy function code.')
      functionProperties = await this.handlerCode(serviceProp, functionProp, serviceName, projectName)
    } else {
      functionProperties = {
        ...this.handlerConfig(functionProp),
        ...await this.handlerCode(serviceProp, functionProp, serviceName, projectName)
      }
    }

    try {
      await this.fcClient.getFunction(serviceName, functionName)
      try {
        this.logger.info(`Function: ${serviceName}@${functionName} updating ...`)
        await this.fcClient.updateFunction(
          serviceName,
          functionName,
          functionProperties
        )
      } catch (ex) {
        throw new Error(
          `${serviceName}:${functionName} update failed: ${ex.message}`
        )
      }
    } catch (e) {
      if (e.code !== 'FunctionNotFound') {
        throw e
      }
      try {
        this.logger.info(`Function: ${serviceName}@${functionName} creating ...`)
        await this.fcClient.createFunction(serviceName, functionProperties)
      } catch (ex) {
        throw new Error(
          `${serviceName}:${functionName} create failed: ${ex.message}`
        )
      }
    }

    this.logger.success(`Deploy function ${functionName} successfully`)

    return functionName
  }

  async pushImage (serviceName, functionName, userName, password, imageName) {
    const cr = new AliyunContainerRepository(this.credentials, this.region)
    const registry = imageName ? imageName.split('/')[0] : this.builder.getDefaultRegistry(this.region)

    if (userName && password) {
      this.logger.info('Login to the registry...')
      try {
        execSync(`docker login --username=${userName} ${registry} --password-stdin`, {
          input: password
        })
        this.logger.success(`Login to registry with user: ${userName}`)
      } catch (e) {
        this.logger.error('Login to registry failed.')
        throw e
      }
    } else {
      this.logger.info('Try to use a temporary token for login')
      const { User: tmpUser, Password: tmpPassword } = await cr.getAuthorizationToken()
      try {
        execSync(`docker login --username=${tmpUser} ${registry} --password-stdin`, {
          input: tmpPassword
        })
        this.logger.success(`Login to registry with user: ${tmpUser}`)
      } catch (e) {
        this.logger.warn('Login to registry failed with temporary token, now fallback to your current context.')
      }
    }

    if (!imageName) {
      this.logger.info('Use default namespace and repository')
      const defaultNamespace = this.builder.getDefaultNamespace()
      this.logger.info(`Ensure default namespace exists: ${defaultNamespace}`)
      await cr.ensureNamespace(defaultNamespace)
      imageName = this.builder.getDefaultImageName(this.region, serviceName, functionName)
    }

    this.logger.info('Pushing image to registry')
    execSync(`docker push ${imageName}`, {
      stdio: 'inherit'
    })
    this.logger.success(`Push image to registry successfully: ${imageName}`)

    return imageName
  }
}

module.exports = Function
