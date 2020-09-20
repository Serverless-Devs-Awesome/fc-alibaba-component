const Oss = require('ali-oss')

class OSS {
  constructor (credentials, region, bucketName) {
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region
    this.ossClient = new Oss({
      region: this.region,
      accessKeyId: this.accessKeyID,
      accessKeySecret: this.accessKeySecret,
      bucket: bucketName
    })
  }

  async uploadFile (filePath, object) {
    await this.ossClient.put(object, filePath)
  }
}

module.exports = OSS
