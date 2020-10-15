'use strict'

const {
  startSboxContainer,
  pullImageIfNeed,
  resolveNasConfigToMounts,
  resolveCodeUriToMount,
  resolvePasswdMount
} = require('./docker')

const _ = require('lodash')
const { resolveRuntimeToDockerImage } = require('./docker-opts')
const definition = require('../tpl/definition')
const { detectTplPath, getTpl, validateTplName } = require('../tpl/tpl')
const { addEnv } = require('../install/env')
const { red } = require('colors')
const path = require('path')
const nas = require('../nas/nas')

async function sbox (options) {
  const funcPath = options.function
  const cmd = options.cmd
  let envs = options.envs
  const isInteractive = options.interactive
  const isTty = (isInteractive && process.stdin.isTTY) || false
  let tplPath = options.template; let codeUri; let runtime = options.runtime; let mounts = []

  if (funcPath) {
    if (!tplPath) {
      tplPath = await detectTplPath(false)
    }

    if (!tplPath) {
      console.error(red('The `template.yml` file is not found in current directory.'))
      return
    }

    validateTplName(tplPath)

    const baseDir = path.resolve(path.dirname(tplPath))
    const tpl = await getTpl(tplPath)

    const { functionRes, serviceName, serviceRes } = definition.findFunctionInTpl(funcPath, tpl)

    if (!functionRes) {
      throw new Error(red(`can not find function ${funcPath}`))
    }

    codeUri = path.resolve(baseDir, functionRes.Properties.CodeUri)

    if (!runtime) {
      runtime = functionRes.Properties.Runtime
    }

    const nasConfig = (serviceRes.Properties || {}).NasConfig
    mounts = await resolveNasConfigToMounts(baseDir, serviceName, nasConfig, nas.getDefaultNasDir(baseDir))

    envs = addEnv(envs, nasConfig)
  } else if (options.runtime) {
    codeUri = process.cwd()
  }

  mounts.push(await resolveCodeUriToMount(codeUri, false))
  mounts.push(await resolvePasswdMount())

  const imageName = await resolveRuntimeToDockerImage(runtime, true)

  await pullImageIfNeed(imageName)

  await startSboxContainer({
    runtime,
    imageName,
    mounts: _.compact(mounts),
    cmd,
    envs,
    isTty,
    isInteractive
  })
}

async function sboxForServerless ({ serviceName, serviceProps, functionName, functionProps, runtime, isInteractive, cmd, baseDir, absCodeUri, envs = {} }) {
  const isTty = (isInteractive && process.stdin.isTTY) || false
  let mounts = []

  if (!runtime) {
    runtime = functionProps.Runtime
  }

  const nasConfig = (serviceProps || {}).NasConfig
  mounts = await resolveNasConfigToMounts(baseDir, serviceName, nasConfig, nas.getDefaultNasDir(baseDir))

  envs = addEnv(envs, nasConfig)

  mounts.push(await resolveCodeUriToMount(absCodeUri, false))
  mounts.push(await resolvePasswdMount())

  const imageName = await resolveRuntimeToDockerImage(runtime, true)

  await pullImageIfNeed(imageName)

  await startSboxContainer({
    runtime,
    imageName,
    mounts: _.compact(mounts),
    cmd,
    envs,
    isTty,
    isInteractive
  })
}

module.exports = { sbox, sboxForServerless }
