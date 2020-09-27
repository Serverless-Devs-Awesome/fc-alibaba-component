const FC = require('@alicloud/fc2')
const moment = require('moment')
const fs = require('fs')
const fse = require('fs-extra')
const path = require('path')
const { DEFAULT } = require('./static')
const { packTo } = require('@serverless-devs/s-zip')
const OSS = require('../oss')
const { execSync } = require('child_process')

const Builder = require('./builder')
const util = require('util')
const ncp = require('../ncp')
const ncpAsync = util.promisify(ncp)

class Function {
  constructor (credentials, region) {
    this.credentials = credentials
    this.accountId = credentials.AccountID
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region
    this.fcClient = new FC(credentials.AccountID, {
      accessKeyID: credentials.AccessKeyID,
      accessKeySecret: credentials.AccessKeySecret,
      region: region,
      timeout: 6000000
    })
  }

  async makeCacheDir (path) {
    if (!(await fs.existsSync(path))) {
      await fs.mkdirSync(path)
    }
  }

  async getFunctionCode (baseDir, serviceName, functionName, runtime, code, projectName) {
    const cachePath = path.join(process.cwd(), '.s', 'cache')
    const zipPath = path.join(cachePath, `${projectName}.zip`)
    const singlePathConfigued = typeof code === 'string'
    const codeUri = singlePathConfigued ? code : code.Src
    const artifactConfigured = codeUri && (codeUri.endsWith('.s-zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war'))

    // check if configured valid
    if (!singlePathConfigued) {
      if (!code.Bucket || !code.Object) {
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
      const packToParame = {
        outputFilePath: cachePath,
        outputFileName: `${projectName}.zip`
      }
      if (singlePathConfigued) {
        packToParame.codeUri = code
      } else {
        packToParame.codeUri = code.Src
        packToParame.exclude = code.Exclude
        packToParame.include = code.Include
      }
      const builder = new Builder()
      const buildArtifactPath = builder.getArtifactPath(baseDir, serviceName, functionName)
      if (packToParame.codeUri && builder.runtimeMustBuild(runtime)) {
        if (!builder.hasBuild(baseDir, serviceName, functionName)) {
          throw new Error("You need to build artifact with 's build' before you deploy.")
        }
        packToParame.codeUri = buildArtifactPath
      } else if (packToParame.codeUri && fs.existsSync(buildArtifactPath)) {
        // has execute build before, copy code to build artifact path and zip
        console.log(`Found build artifact directory: ${buildArtifactPath}, now composing your code and dependencies with those built before.`)
        await ncpAsync(packToParame.codeUri, buildArtifactPath, {
          filter: (source) => {
            if (source.endsWith('.s') || source.endsWith('.fun') || source.endsWith('.git')) {
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

    if (singlePathConfigued) {
      // artifact configured
      const data = await fs.readFileSync(zipPath)
      return {
        zipFile: Buffer.from(data).toString('base64')
      }
    } else {
      // OSS configured
      if (!codeUri) {
        return {
          ossBucketName: code.Bucket,
          ossObjectName: code.Object
        }
      }
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
      console.log(`Deleting function ${serviceName}@${functionName}`)
      await this.fcClient.deleteFunction(serviceName, functionName)
      console.log(`Delete function ${serviceName}@${functionName} successfully`)
    } catch (err) {
      if (err.code !== 'FunctionNotFound') {
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
    if (functionInput.Environment) {
      const EnvironmentAttr = {}
      for (let i = 0; i < functionInput.Environment.length; i++) {
        EnvironmentAttr[functionInput.Environment[i].Key] = functionInput.Environment[i].Value
      }
      functionProperties.environmentVariables = EnvironmentAttr
    }
    return functionProperties
  }

  async handlerCode (serviceInput, functionInput, serviceName, projectName) {
    const functionProperties = {}

    const deployContainerFunction = functionInput.Runtime === 'custom-container'
    if (deployContainerFunction) {
      if (!functionInput.CustomContainer) {
        throw new Error('No CustomContainer found for container runtime')
      }
      if (!functionInput.CustomContainer.Image) {
        throw new Error('No CustomContainerConfig.Image found for container runtime')
      }
      if (!functionInput.CustomContainer.CrAccount) {
        throw new Error('No CustomContainerConfig.CrAccount found for container runtime')
      }
      if (!functionInput.CustomContainer.CrAccount.User) {
        throw new Error('No CustomContainerConfig.CrAccount.User found for container runtime')
      }
      if (!functionInput.CustomContainer.CrAccount.Password) {
        throw new Error('No CustomContainerConfig.CrAccount.Password found for container runtime')
      }
      // code和customContainerConfig不能同时存在
      functionProperties.code = undefined
      functionProperties.customContainerConfig = {
        image: functionInput.CustomContainer.Image
      }
      if (functionInput.CustomContainer.Command) {
        functionProperties.customContainerConfig.command = functionInput.CustomContainer.Command
      }
      if (functionInput.CustomContainer.Args) {
        functionProperties.customContainerConfig.args = functionInput.CustomContainer.Args
      }
      try {
        // Push image to repo for custom-container
        const customContainer = functionInput.CustomContainer
        await this.pushImage(customContainer.CrAccount.User, customContainer.CrAccount.Password, customContainer.Image)
      } catch (e) {
        console.log(e)
        throw e
      }
    } else {
      const baseDir = process.cwd()
      const functionName = functionInput.Name
      const runtime = functionInput.Runtime
      const codeUri = functionInput.CodeUri
      functionProperties.code = await this.getFunctionCode(baseDir, serviceName, functionName, runtime, codeUri, projectName)
      // functionProperties.code = await this.getFunctionCode(functionInput.CodeUri, projectName)
    }
    return functionProperties
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
      console.log('Only deploy function config.')
      functionProperties = this.handlerConfig(functionProp)
    } else if (onlyDelpoyCode) {
      console.log('Only deploy function code.')
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
        console.log(`Function: ${serviceName}@${functionName} updating ...`)
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
      try {
        console.log(`Function: ${serviceName}@${functionProperties.functionName} creating ...`)
        await this.fcClient.createFunction(serviceName, functionProperties)
      } catch (ex) {
        throw new Error(
          `${serviceName}:${functionName} create failed: ${ex.message}`
        )
      }
    }

    console.log(`Deployment function ${functionName} successful.`)

    return functionName
  }

  async pushImage (userName, password, imageName) {
    try {
      const registry = imageName.split('/')[0]
      execSync(`docker login --username=${userName} ${registry} --password-stdin`, {
        input: password
      })

      execSync(`docker push ${imageName}`, {
        stdio: 'inherit'
      })

      console.log(`Push image(${imageName}) to registry successfully`)
    } catch (e) {
      console.log(e.message)
      throw e
    }
  }
}

module.exports = Function
