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
const { yellow } = require('colors')
const Install = require('./install')
const execSync = require('child_process').execSync

class Builder {
  constructor () {

  }

  async build (serviceName, serviceProps, functionName, functionProps, useDocker, verbose) {
    const codeUri = functionProps.CodeUri
    const baseDir = process.cwd()
    const runtime = functionProps.Runtime

    if (! await this.codeNeedBuild(baseDir, codeUri, runtime)) {
      return;
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

    //await this.collectArtifact(functionProps.Runtime, artifactPath)
  }

async buildInDocker (serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, funcArtifactDir, verbose) {
    const stages = ['install', 'build']
    const nasProps = {}
    const runtime = functionProps.Runtime;

    let imageTag;
    const funfilePath = path.resolve(baseDir, codeUri, 'fcfile');
    if (fs.existsSync(funfilePath)) {
      console.log(yellow('Found fcfile in your codrUri directory.'));
      const installer = new Install();
      imageTag = await installer.processFunfile(serviceName, serviceProps, codeUri, funfilePath, baseDir, funcArtifactDir, runtime, functionName);
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
    console.log('\nbuild function using image: ' + usedImage)

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

    const builder = new fcBuilders.Builder(serviceName, functionName, codePath, runtime, artifactPath, verbose, stages)
    await builder.build()
  }

  async buildImage (customContainer) {
    if (!customContainer) {
      throw new Error(`No 'CustomContainer' configuration found in template.yml.`)
    }
    let dockerFile = 'Dockerfile'
    if (customContainer && customContainer.Dockerfile) {
      dockerFile = customContainer.Dockerfile
    }
    if (!customContainer.Image) {
      throw new Error('No CustomContainer.Image found for container build')
    }
    const imageName = customContainer.Image

    if (!fs.existsSync(dockerFile)) {
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

  // async collectArtifact (runtime, funcArtifactDir) {
  //   if (!fs.pathExistsSync(funcArtifactDir)) {
  //     return
  //   }

  //   if (runtime.includes('python')) {
  //     // copy dependency to the root dir for deploy/package later
  //     let source
  //     const pythonLibDir = path.join(funcArtifactDir, '.fun', 'python', 'lib')
  //     if (!fs.pathExistsSync(pythonLibDir)) {
  //       return
  //     }
  //     const libs = fs.readdirSync(pythonLibDir)
  //     if (libs.length == 1) {
  //       source = path.join(pythonLibDir, libs[0], 'site-packages')
  //     } else {
  //       source = path.join(pythonLibDir, 'python', 'site-packages')
  //       libs.forEach(dir => {
  //         if (runtime === 'python3' && dir === 'python3.6') {
  //           source = path.join(pythonLibDir, 'python3.6', 'site-packages')
  //         } else if (runtime === 'python2.7' && dir === 'python2.7') {
  //           source = path.join(pythonLibDir, 'python2.7', 'site-packages')
  //         }
  //       })
  //     }

  //     await ncpAsync(source, funcArtifactDir)
  //   }

  //   // remove the unecessary directory
  //   fs.rmdirSync(path.join(funcArtifactDir, '.fun'), { recursive: true })
  // }

  isOnlyDefaultTaskFlow (taskFlows) {
    if (taskFlows.length !== 1) { return false }

    return taskFlows[0].name === 'DefaultTaskFlow'
  }

  runtimeMustBuild (runtime) {
    if (!runtime || typeof runtime !== 'string') {
      return false
    }
    return runtime.includes('java');
  }

  async codeNeedBuild (baseDir, codeUri, runtime) {
    //check codeUri
    if (!codeUri) {
      console.warn('No code uri configured, skip building.');
      return false;
    }
    if (typeof codeUri == 'string') {
      if (codeUri.endsWith('.zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war')) {
        console.log('Artifact configured, skip building.');
        return false;
      }
    } else {
      if (!codeUri.Src) {
        console.log('No Src configured, skip building.');
        return false;
      }
      if (codeUri.Src.endsWith('.zip') || codeUri.Src.endsWith('.jar') || codeUri.Src.endsWith('.war')) {
        console.log('Artifact configured, skip building.');
        return false;
      }
    }

    const Builder = fcBuilders.Builder;
    const absCodeUri = path.resolve(baseDir, codeUri);
    const taskFlows = await Builder.detectTaskFlow(runtime, absCodeUri);
    if (_.isEmpty(taskFlows) || this.isOnlyDefaultTaskFlow(taskFlows)) {
        console.log("No need build for this project.");
        return false;
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
                source == 'vendor' || source == 'node_modules') {
            return false
          }
          return true
        }
      })
    } catch (e) {
      console.log(e)
    }
  }

  codeUriCanBuild (codeUri) {
    if (!codeUri) {
      console.warn('No code uri configured, skip building.')
      return false
    }

    if (typeof codeUri === 'string') {
      if (codeUri.endsWith('.zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war')) {
        console.log('Artifact configured, skip building.')
        return false
      }
    } else {
      if (!codeUri.Src) {
        console.log('No Src configured, skip building.')
        return false
      }
      if (codeUri.Src.endsWith('.zip') || codeUri.Src.endsWith('.jar') || codeUri.Src.endsWith('.war')) {
        console.log('Artifact configured, skip building.')
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
}

module.exports = Builder
