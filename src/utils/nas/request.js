'use strict'

const { getFcClient } = require('../client')
const { readFileChunk } = require('./cp/file')

const path = require('path')
const constants = require('./constants')
const PROXY = 'proxy'

function getNasHttpTriggerPath (serviceName) {
  let nasServiceName
  if (serviceName.indexOf(constants.FUN_NAS_SERVICE_PREFIX) !== 0) {
    nasServiceName = constants.FUN_NAS_SERVICE_PREFIX + serviceName
  } else {
    nasServiceName = serviceName
  }
  return `/${PROXY}/${nasServiceName}/${constants.FUN_NAS_FUNCTION}/`
}

async function getRequest (credentials, region, path, query, headers) {
  return await request(credentials, region, 'GET', path, query, headers)
}

async function postRequest (credentials, region, path, query, body, headers, opts) {
  return await request(credentials, region, 'POST', path, query, body, headers, opts)
}

async function request (credentials, region, method, path, query, body, headers, opts) {
  const fcClient = await getFcClient(credentials, region, {
    timeout: constants.FUN_NAS_TIMEOUT
  })

  headers = Object.assign(headers || {}, {
    'X-Fc-Log-Type': 'Tail'
  })

  const res = await fcClient.request(method, path, query, body, headers, opts || {})

  const data = (res && res.data) || {}

  if (data.error) {
    throw new Error(data.error)
  }

  return res
}

async function statsRequest (credentials, region, dstPath, nasHttpTriggerPath) {
  const urlPath = nasHttpTriggerPath + 'stats'
  const query = { dstPath }
  return await getRequest(credentials, region, urlPath, query)
}

async function sendCmdRequest (credentials, region, nasHttpTriggerPath, cmd) {
  const urlPath = nasHttpTriggerPath + 'commands'
  const query = {}
  const body = { cmd }

  return await postRequest(credentials, region, urlPath, query, body)
}

async function nasPathExsit (credentials, region, nasHttpTriggerPath, nasPath) {
  const urlPath = nasHttpTriggerPath + 'path/exsit'
  const query = { path: nasPath }
  return await getRequest(credentials, region, urlPath, query)
}

async function checkFileHash (credentials, region, nasHttpTriggerPath, nasFile, fileHash) {
  const urlPath = nasHttpTriggerPath + 'file/check'
  const query = { nasFile, fileHash }
  return await getRequest(credentials, region, urlPath, query)
}

async function sendZipRequest (credentials, region, nasHttpTriggerPath, nasPath, tmpNasZipPath) {
  const cmd = `cd ${path.dirname(nasPath)} && zip -r ${tmpNasZipPath} ${path.basename(nasPath)}`
  return await sendCmdRequest(credentials, region, nasHttpTriggerPath, cmd)
}

async function sendDownLoadRequest (credentials, region, nasHttpTriggerPath, tmpNasZipPath) {
  const urlPath = nasHttpTriggerPath + 'download'
  const query = {}
  const body = { tmpNasZipPath }

  return await postRequest(credentials, region, urlPath, query, body, null, {
    rawBuf: true
  })
}

async function sendUnzipRequest (credentials, region, nasHttpTriggerPath, dstDir, nasZipFile, unzipFiles, noClobber) {
  let cmd
  if (noClobber) {
    cmd = `unzip -q -n ${nasZipFile} -d ${dstDir}`
  } else {
    cmd = `unzip -q -o ${nasZipFile} -d ${dstDir}`
  }

  for (const unzipFile of unzipFiles) {
    cmd = cmd + ` '${unzipFile}'`
  }

  return await sendCmdRequest(credentials, region, nasHttpTriggerPath, cmd)
}

async function sendCleanRequest (credentials, region, nasHttpTriggerPath, nasZipFile) {
  const urlPath = nasHttpTriggerPath + 'clean'
  const query = { nasZipFile }
  return await getRequest(credentials, region, urlPath, query)
}

async function createSizedNasFile (credentials, region, nasHttpTriggerPath, nasZipFile, fileSize) {
  const cmd = `dd if=/dev/zero of=${nasZipFile} count=0 bs=1 seek=${fileSize}`
  return await sendCmdRequest(credentials, region, nasHttpTriggerPath, cmd)
}

async function uploadChunkFile (credentials, region, nasHttpTriggerPath, nasFile, zipFilePath, offSet) {
  const urlPath = nasHttpTriggerPath + 'file/chunk/upload'
  const fileStart = offSet.start
  const fileSize = offSet.size
  const query = {
    nasFile,
    fileStart: fileStart.toString()
  }

  const body = await readFileChunk(credentials, region, zipFilePath, fileStart, fileSize)

  const headers = {}
  return await postRequest(credentials, region, urlPath, query, body, headers)
}

// 检查远端 NAS 临时文件夹是否存在
// 不存在则创建，且权限赋予
async function checkRemoteNasTmpDir (credentials, region, nasHttpTriggerPath, remoteNasTmpDir) {
  const urlPath = nasHttpTriggerPath + 'tmp/check'
  const query = { remoteNasTmpDir }
  return await getRequest(credentials, region, urlPath, query)
}

async function getVersion (credentials, region, nasHttpTriggerPath) {
  const urlPath = nasHttpTriggerPath + 'version'
  return await getRequest(credentials, region, urlPath)
}

// async function getNasConfig (credentials, region, serviceName) {
//   const service = new Service(credentials, region)
//   const serviceMeta = await service.getService(serviceName)
//   return serviceMeta.nasConfig
// }

async function changeNasFilePermission (credentials, region, nasHttpTriggerPath, filePath, filePermission) {
  const cmd = `chmod ${filePermission} ${filePath}`
  return await sendCmdRequest(credentials, region, nasHttpTriggerPath, cmd)
}

module.exports = {
  getVersion,
  // getNasConfig,
  getNasHttpTriggerPath,
  createSizedNasFile,
  uploadChunkFile,
  statsRequest,
  checkRemoteNasTmpDir,
  checkFileHash,
  changeNasFilePermission,
  nasPathExsit,
  sendZipRequest,
  sendDownLoadRequest,
  sendCleanRequest,
  sendCmdRequest,
  sendUnzipRequest
}
