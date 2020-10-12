'use strict'

const Client = require('./fc/client')

class OSS extends Client {
  constructor (credentials, region, bucketName) {
    super(credentials, region)
    this.ossClient = this.buildOssClient(bucketName)
  }

  async uploadFile (filePath, object) {
    await this.ossClient.put(object, filePath)
  }
}

module.exports = OSS
