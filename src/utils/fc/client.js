'use strict'

const FC = require('@alicloud/fc2')
const Log = require('@alicloud/log')
const RAM = require('@alicloud/ram')
const OSS = require('ali-oss')

const { SLS } = require('aliyun-sdk')

class Client {
  constructor (credentials, region) {
    this.region = region
    this.credentials = credentials

    this.accountId = credentials.AccountID
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.stsToken = credentials.SecurityToken
  }

  buildFcClient () {
    return new FC(this.accountId, {
      accessKeyID: this.accessKeyID,
      accessKeySecret: this.accessKeySecret,
      securityToken: this.stsToken,
      region: this.region,
      timeout: 6000000
    })
  }

  buildRamClient () {
    return new RAM({
      accessKeyId: this.accessKeyID,
      accessKeySecret: this.accessKeySecret,
      securityToken: this.stsToken,
      endpoint: 'https://ram.aliyuncs.com',
      opts: {
        timeout: 60000
      }
    })
  }

  buildOssClient (bucketName) {
    return new OSS({
      region: this.region,
      accessKeyId: this.accessKeyID,
      accessKeySecret: this.accessKeySecret,
      stsToken: this.stsToken,
      bucket: bucketName
    })
  }

  buildSlsClient (useAliyunSdk = true) {
    if (useAliyunSdk) {
      return new SLS({
        accessKeyId: this.accessKeyID,
        secretAccessKey: this.accessKeySecret,
        endpoint: `http://${this.region}.log.aliyuncs.com`,
        apiVersion: '2015-06-01'
      })
    }
    return new Log({
      region: this.region,
      accessKeyId: this.accessKeyID,
      accessKeySecret: this.accessKeySecret
    })
  }
}

module.exports = Client
