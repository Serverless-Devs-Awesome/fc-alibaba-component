'use strict'

const osLocale = require('os-locale')
const MNSClient = require('@alicloud/mns')
const hashedMachineId = require('node-machine-id').machineId
const pkg = require('../../package.json')
const CloudAPI = require('@alicloud/cloudapi')
const TableStore = require('tablestore')
const Log = require('@alicloud/log')
const FC = require('@alicloud/fc2')
const FnFClient = require('@alicloud/fnf-2019-03-15')
const Pop = require('@alicloud/pop-core')
const getProfile = require('./tpl/profile').getProfile
const OSS = require('ali-oss')
const debug = require('debug')
const {
  throwProcessedFCPermissionError,
  throwProcessedPopPermissionError,
  throwProcessedSLSPermissionError
} = require('./error/error-message')

const getRosClient = async (credential) => {
  return await getPopClientByCredential(credential, 'http://ros.aliyuncs.com', '2019-09-10')
}

const getOssClient = async (credential, region, bucket) => {
  const timeout = credential.Timeout || 60
  if (!bucket) {
    return OSS({
      region: 'oss-' + region,
      accessKeyId: credential.AccessKeyID,
      accessKeySecret: credential.AccessKeySecret,
      timeout: timeout * 1000
    })
  }

  const location = await OSS({
    accessKeyId: credential.AccessKeyID,
    accessKeySecret: credential.AccessKeySecret,
    bucket,
    region: 'oss-' + region
  }).getBucketLocation(bucket)

  debug('use bucket region %s', location.location)

  const client = OSS({
    accessKeyId: credential.AccessKeyID,
    accessKeySecret: credential.AccessKeySecret,
    bucket,
    region: location.location,
    timeout: timeout * 1000
  })

  return client
}

const getFcClient = async (credentials, region, opts = {}) => {
  const locale = await osLocale()

  const mid = await hashedMachineId()

  FC.prototype.getAccountSettings = function (options = {}, headers = {}) {
    return this.get('/account-settings', options, headers)
  }

  const accountId = credentials.AccountID ? credentials.AccountID : 'accountId'
  const accessKeyID = credentials.AccessKeyID ? credentials.AccessKeyID : 'accessKeyID'
  const accessKeySecret = credentials.AccessKeySecret ? credentials.AccessKeySecret : 'accessKeySecret'
  const securityToken = credentials.SecurityToken
  const secure = credentials.protocol && credentials.protocol !== 'http'

  const fc = new FC(accountId, {
    accessKeyID,
    accessKeySecret,
    securityToken,
    region,
    timeout: (opts.timeout || 60) * 1000,
    secure,
    headers: {
      'user-agent': `${pkg.name}/v${pkg.version} ( Node.js ${process.version}; OS ${process.platform} ${process.arch}; language ${locale}; mid ${mid})`
    }
  })
  const realRequest = fc.request.bind(fc)
  fc.request = async (method, path, query, body, headers, opts = {}) => {
    try {
      return await realRequest(method, path, query, body, headers || {}, opts || {})
    } catch (ex) {
      await throwProcessedFCPermissionError(ex, ...path.split('/').filter(p => !!p))
      throw ex
    }
  }

  return fc
}

const getFnFClient = async (credential, region) => {
  return new FnFClient({
    endpoint: `https://${credential.AccountID}.${region}.fnf.aliyuncs.com`,
    accessKeyId: credential.AccessKeyID,
    accessKeySecret: credential.AccessKeySecret
  })
}

// Deprecated. Use getPopClientByCredential instead.
const getPopClient = async (endpoint, apiVersion) => {
  const profile = await getProfile()

  const pop = new Pop({
    endpoint: endpoint,
    apiVersion: apiVersion,
    accessKeyId: profile.accessKeyId,
    accessKeySecret: profile.accessKeySecret,
    opts: {
      timeout: profile.timeout * 1000
    }
  })

  const realRequest = pop.request.bind(pop)
  pop.request = async (action, params, options) => {
    try {
      return await realRequest(action, params, options)
    } catch (ex) {
      await throwProcessedPopPermissionError(ex, action)
      throw ex
    }
  }

  return pop
}

const getPopClientByCredential = async (credential, endpoint, apiVersion) => {
  const timeout = credential.Timeout || 60
  const pop = new Pop({
    endpoint: endpoint,
    apiVersion: apiVersion,
    accessKeyId: credential.AccessKeyID || credential.AccessKeyId,
    accessKeySecret: credential.AccessKeySecret,
    opts: {
      timeout: timeout * 1000
    }
  })

  const realRequest = pop.request.bind(pop)
  pop.request = async (action, params, options) => {
    try {
      return await realRequest(action, params, options)
    } catch (ex) {
      await throwProcessedPopPermissionError(ex, action)
      throw ex
    }
  }

  return pop
}

const getOtsPopClient = async () => {
  const profile = await getProfile()

  return await getPopClient(`http://ots.${profile.defaultRegion}.aliyuncs.com`, '2016-06-20')
}

const getVpcPopClient = async (credential) => {
  return await getPopClientByCredential(credential, 'https://vpc.aliyuncs.com', '2016-04-28')
}

const getEcsPopClient = async (credential) => {
  return await getPopClientByCredential(credential, 'https://ecs.aliyuncs.com', '2014-05-26')
}

const getNasPopClient = async (credential, region) => {
  return await getPopClientByCredential(credential, `http://nas.${region}.aliyuncs.com`, '2017-06-26')
}

const getOtsClient = async (instanceName) => {
  const profile = await getProfile()

  var endpoint = `http://${instanceName}.${profile.defaultRegion}.ots.aliyuncs.com`
  return new TableStore.Client({
    accessKeyId: profile.accessKeyId,
    secretAccessKey: profile.accessKeySecret,
    endpoint: endpoint,
    instancename: instanceName
  })
}

const getMnsClient = async (topicName, region) => {
  const profile = await getProfile()

  return new MNSClient(profile.accountId, {
    region: region,
    accessKeyId: profile.accessKeyId,
    accessKeySecret: profile.accessKeySecret,
    // optional & default
    secure: false, // use https or http
    internal: false, // use internal endpoint
    vpc: false // use vpc endpoint
  })
}

const getCloudApiClient = async () => {
  const profile = await getProfile()

  return new CloudAPI({
    accessKeyId: profile.accessKeyId,
    accessKeySecret: profile.accessKeySecret,
    endpoint: `http://apigateway.${profile.defaultRegion}.aliyuncs.com`,
    opts: {
      timeout: profile.timeout * 1000
    }
  })
}

const getSlsClient = async () => {
  const profile = await getProfile()

  const log = new Log({
    region: profile.defaultRegion,
    accessKeyId: profile.accessKeyId,
    accessKeySecret: profile.accessKeySecret
  })

  const realRequest = log._request.bind(log)
  log._request = async (verb, projectName, path, queries, body, headers, options) => {
    try {
      return await realRequest(verb, projectName, path, queries, body, headers, options)
    } catch (ex) {
      await throwProcessedSLSPermissionError(ex)
      throw ex
    }
  }

  return log
}

module.exports = {
  getFcClient,
  getOtsClient,
  getOtsPopClient,
  getMnsClient,
  getCloudApiClient,
  getSlsClient,
  getPopClient,
  getVpcPopClient,
  getEcsPopClient,
  getNasPopClient,
  getOssClient,
  getRosClient,
  getFnFClient
}
