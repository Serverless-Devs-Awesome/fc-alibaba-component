'use strict'

const {
  generateDockerDebugOpts
} = require('./debug')

const debug = require('debug')('docker-opts')
const nestedObjectAssign = require('nested-object-assign')
const { addEnv } = require('../install/env')
const definition = require('../tpl/definition')

const _ = require('lodash')

const { red } = require('colors')
const httpx = require('httpx')
const getVisitor = require('../tpl/visitor').getVisitor
const pkg = require('../../package.json')

const NAS_UID = 10003
const NAS_GID = 10003

const DEFAULT_REGISTRY = pkg['fc-docker'].registry_default || 'registry.hub.docker.com'
const DOCKER_REGISTRIES = pkg['fc-docker'].registry_mirrors || ['registry.hub.docker.com']

let DOCKER_REGISTRY_CACHE

const runtimeImageMap = {
  nodejs6: 'nodejs6',
  nodejs8: 'nodejs8',
  nodejs10: 'nodejs10',
  nodejs12: 'nodejs12',
  'python2.7': 'python2.7',
  python3: 'python3.6',
  java8: 'java8',
  'php7.2': 'php7.2',
  'dotnetcore2.1': 'dotnetcore2.1',
  custom: 'custom'
}

function resolveDockerEnv (envs = {}) {
  return _.map(addEnv(envs || {}), (v, k) => `${k}=${v}`)
}

async function doImageRegisterEventTag (el) {
  const visitor = await getVisitor()
  visitor.event({
    ec: 'imageRegistry',
    ea: 'resolve',
    el
  }).send()
}

async function resolveDockerRegistry () {
  await doImageRegisterEventTag('start')
  if (DOCKER_REGISTRY_CACHE) {
    return DOCKER_REGISTRY_CACHE
  }
  const promises = DOCKER_REGISTRIES.map(r => httpx.request(`https://${r}/v2/aliyunfc/runtime-nodejs8/tags/list`, { timeout: 3000 }).then(() => r))
  try {
    DOCKER_REGISTRY_CACHE = await Promise.race(promises)
  } catch (error) {
    DOCKER_REGISTRY_CACHE = DEFAULT_REGISTRY
  }
  await doImageRegisterEventTag(DOCKER_REGISTRY_CACHE)
  return DOCKER_REGISTRY_CACHE
}

const IMAGE_VERSION = pkg['fc-docker'].version || '1.9.2'

async function resolveRuntimeToDockerImage (runtime, isBuild) {
  if (runtimeImageMap[runtime]) {
    const name = runtimeImageMap[runtime]
    var imageName
    if (isBuild) {
      imageName = `aliyunfc/runtime-${name}:build-${IMAGE_VERSION}`
    } else {
      imageName = `aliyunfc/runtime-${name}:${IMAGE_VERSION}`
    }

    debug('imageName: ' + imageName)
    return imageName
  }
  throw new Error(red(`invalid runtime name ${runtime}`))
}

async function resolveImageNameForPull (imageName) {
  const dockerImageRegistry = await resolveDockerRegistry()

  if (dockerImageRegistry) {
    imageName = `${dockerImageRegistry}/${imageName}`
  }
  return imageName
}

function generateInstallOpts (imageName, mounts, envs) {
  return {
    Image: imageName,
    Tty: true,
    Env: resolveDockerEnv(envs),
    Cmd: ['/bin/bash'],
    HostConfig: {
      AutoRemove: true,
      Mounts: mounts
    }
  }
}

function generateContainerName (serviceName, functionName, debugPort) {
  return `fun-local-${serviceName}-${functionName}`.replace(/ /g, '') +
    (debugPort ? '-debug' : '-run')
}

function generateContainerNameFilter (containerName, inited) {
  if (inited) {
    return `{"name": ["${containerName}-inited"]}`
  }
  return `{"name": ["${containerName}"]}`
}

function generateSboxOpts ({ imageName, hostname, mounts, envs, cmd = [], isTty, isInteractive }) {
  return {
    Image: imageName,
    Hostname: hostname,
    AttachStdin: isInteractive,
    AttachStdout: true,
    AttachStderr: true,
    User: resolveDockerUser({ stage: 'sbox' }),
    Tty: isTty,
    OpenStdin: isInteractive,
    StdinOnce: true,
    Env: resolveDockerEnv(envs),
    Cmd: cmd.length ? cmd : ['/bin/bash'],
    HostConfig: {
      AutoRemove: true,
      Mounts: mounts
    }
  }
}

function transformPathForVirtualBox (source) {
  // C:\\Users\\image_crawler\\code -> /c/Users/image_crawler/code
  const sourcePath = source.split(':').join('')
  const lowerFirstAndReplace = _.lowerFirst(sourcePath.split('\\').join('/'))
  return '/' + lowerFirstAndReplace
}

function transformMountsForToolbox (mounts) {
  console.warn(red('We detected that you are using docker toolbox. For a better experience, please upgrade \'docker for windows\'.\nYou can refer to Chinese doc https://github.com/alibaba/funcraft/blob/master/docs/usage/installation-zh.md#windows-%E5%AE%89%E8%A3%85-docker or English doc https://github.com/alibaba/funcraft/blob/master/docs/usage/installation.md.\n'))

  if (Array.isArray(mounts)) {
    return mounts.map(m => {
      return transformSourcePathOfMount(m)
    })
  }
  return transformSourcePathOfMount(mounts)
}

function transformSourcePathOfMount (mountsObj) {
  if (!_.isEmpty(mountsObj)) {
    const replaceMounts = Object.assign({}, mountsObj)
    replaceMounts.Source = transformPathForVirtualBox(mountsObj.Source)
    return replaceMounts
  }
  return {}
}

async function generateContainerBuildOpts (runtime, containerName, mounts, cmd, envs, preferredImage) {
  const hostOpts = {
    HostConfig: {
      AutoRemove: true,
      Mounts: mounts
    }
  }

  const ioOpts = {
    OpenStdin: true,
    Tty: false,
    StdinOnce: true,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true
  }

  const imageName = await resolveRuntimeToDockerImage(runtime, true)

  const opts = nestedObjectAssign(
    {
      Env: resolveDockerEnv(envs),
      Image: preferredImage || imageName,
      name: containerName,
      Cmd: cmd,
      User: resolveDockerUser({ stage: 'build' })
    },
    ioOpts,
    hostOpts)

  debug('fc-docker docker options: %j', opts)

  return opts
}

async function generateLocalInvokeOpts (runtime, containerName, mounts, cmd, debugPort, envs, dockerUser, debugIde) {
  const hostOpts = {
    HostConfig: {
      AutoRemove: true,
      Mounts: mounts
    }
  }

  let debugOpts = {}

  if (debugPort) {
    debugOpts = generateDockerDebugOpts(runtime, debugPort, debugIde)
  }

  const ioOpts = {
    OpenStdin: true,
    Tty: false,
    StdinOnce: true,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true
  }

  const imageName = await resolveRuntimeToDockerImage(runtime)

  supportCustomBootstrapFile(runtime, envs)

  const opts = nestedObjectAssign(
    {
      Env: resolveDockerEnv(envs),
      Image: imageName,
      name: containerName,
      Cmd: cmd,
      User: dockerUser
    },
    ioOpts,
    hostOpts,
    debugOpts)

  debug('fc-docker docker options: %j', opts)

  return opts
}

function resolveMockScript (runtime) {
  return `/var/fc/runtime/${runtime}/mock`
}

/**
 * 支持通过 BOOTSTRAP_FILE 环境变量改变 bootstrap 文件名。
**/
function supportCustomBootstrapFile (runtime, envs) {
  if (runtime === 'custom') {
    if (envs.BOOTSTRAP_FILE) {
      envs.AGENT_SCRIPT = envs.BOOTSTRAP_FILE
    }
  }
}

async function generateLocalStartOpts (runtime, name, mounts, cmd, debugPort, envs, dockerUser, debugIde) {
  const hostOpts = {
    HostConfig: {
      AutoRemove: true,
      Mounts: mounts
    }
  }

  let debugOpts = {}

  if (debugPort) {
    debugOpts = generateDockerDebugOpts(runtime, debugPort, debugIde)
  }

  const imageName = await resolveRuntimeToDockerImage(runtime)

  supportCustomBootstrapFile(runtime, envs)

  const opts = nestedObjectAssign(
    {
      Env: resolveDockerEnv(envs),
      Image: imageName,
      name,
      Cmd: cmd,
      User: dockerUser,
      Entrypoint: [resolveMockScript(runtime)]
    },
    hostOpts,
    debugOpts)

  debug('docker options: %j', opts)

  return opts
}

// Not Run stage:
//  for linux platform, it will always use process.uid and process.gid
//  for mac and windows platform, it will always use 0
// Run stage:
//  for linux platform, it will always use process.uid and process.gid
//  for mac and windows platform, it will use 10003 if no nasConfig, otherwise it will use nasConfig userId
function resolveDockerUser ({ nasConfig, stage = 'run' }) {
  let { userId, groupId } = definition.getUserIdAndGroupId(nasConfig)

  if (process.platform === 'linux') {
    debug('For linux platform, Fun will use host userId and groupId to build or run your functions')
    userId = process.getuid()
    groupId = process.getgid()
  } else {
    if (stage === 'run') {
      if (userId === -1 || userId === undefined) {
        userId = NAS_UID
      }
      if (groupId === -1 || groupId === undefined) {
        groupId = NAS_GID
      }
    } else {
      userId = 0
      groupId = 0
    }
  }

  return `${userId}:${groupId}`
}

module.exports = {
  generateLocalInvokeOpts,
  resolveRuntimeToDockerImage,
  generateInstallOpts,
  generateSboxOpts,
  generateLocalStartOpts,
  resolveMockScript,
  resolveDockerEnv,
  transformPathForVirtualBox,
  resolveDockerRegistry,
  transformMountsForToolbox,
  transformSourcePathOfMount,
  DOCKER_REGISTRIES,
  generateContainerBuildOpts,
  IMAGE_VERSION,
  resolveImageNameForPull,
  generateContainerName,
  generateContainerNameFilter,
  resolveDockerUser
}
