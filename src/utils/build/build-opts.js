'use strict'

const docker = require('../docker/docker')
const dockerOpts = require('../docker/docker-opts')
const path = require('path')
const nas = require('../nas/nas')
const _ = require('lodash')

async function generateBuildContainerBuildOpts (
  credentials, region, serviceName, serviceProps, functionName, functionProps, nasProps, baseDir,
  codeUri, funcArtifactDir, verbose, preferredImage, stages, custom = {}) {
  // TODO use properties directly
  const runtime = custom.Runtime || functionProps.Runtime

  const containerName = docker.generateRamdomContainerName()

  const envs = await docker.generateDockerEnvs(credentials, region, baseDir, serviceName, serviceProps, functionName, functionProps, null, null)
  if (custom.Env) {
    Object.assign(envs, custom.Env)
  }

  const codeMount = await docker.resolveCodeUriToMount(path.resolve(baseDir, codeUri), false)

  const nasMounts = await docker.resolveNasConfigToMounts(baseDir, serviceName, nasProps, nas.getDefaultNasDir(baseDir))
  const passwdMount = await docker.resolvePasswdMount()

  const funcArtifactMountDir = '/artifactsMount'

  const artifactDirMount = {
    Type: 'bind',
    Source: funcArtifactDir,
    Target: funcArtifactMountDir,
    ReadOnly: false
  }

  const mounts = _.compact([codeMount, artifactDirMount, ...nasMounts, passwdMount])

  const params = {
    method: 'build',
    serviceName,
    functionName,
    sourceDir: '/code',
    runtime,
    artifactDir: codeUri === funcArtifactDir ? '/code' : funcArtifactMountDir,
    stages,
    verbose
  }

  const cmd = ['fun-install', 'build', '--json-params', JSON.stringify(params)]

  const opts = await dockerOpts.generateContainerBuildOpts(runtime, containerName, mounts, cmd, envs, preferredImage)

  return opts
}

module.exports = { generateBuildContainerBuildOpts }
