const FC = require('@alicloud/fc2')

class Alias {
  constructor (credentials, region) {
    this.accountId = credentials.AccountID
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region
    this.fcClient = new FC(credentials.AccountID, {
      accessKeyID: credentials.AccessKeyID,
      accessKeySecret: credentials.AccessKeySecret,
      region: region,
      timeout: 60000
    })
    // this.fcClient
  }

  async publish (alias, serviceName) {
    const name = alias.Name
    const versionId = `${alias.Version}`
    const option = {}
    if (alias.Description) {
      option.description = alias.Description
    }
    if (alias.additionalVersionWeight) {
      option.additionalVersionWeight = alias.additionalVersionWeight
    }
    try {
      await this.fcClient.createAlias(serviceName, name, versionId, option)
      return true
    } catch (ex) {
      throw new Error(ex.message)
    }
  }

  async list (serviceName) {
    try {
      return await this.fcClient.listAliases(serviceName)
    } catch (ex) {
      return ex.message
    }
  }

  async findAlias (serviceName, name) {
    const listAlias = await this.list(serviceName)
    if (typeof listAlias === 'string') {
      throw new Error(listAlias)
    }
    const { aliases } = listAlias.data
    for (const alias of aliases) {
      const { aliasName } = alias
      if (aliasName === name) {
        return alias
      }
    }
  }

  async delete (serviceName, aliasName) {
    try {
      await this.fcClient.deleteAlias(serviceName, aliasName)
      return true
    } catch (ex) {
      throw new Error(ex.message)
    }
  }

  async update (alias, serviceName) {
    const name = alias.Name
    const versionId = alias.Version
    const option = {}
    if (alias.Description) {
      option.description = alias.Description
    }
    if (alias.additionalVersionWeight) {
      option.additionalVersionWeight = alias.additionalVersionWeight
    }
    try {
      await this.fcClient.updateAlias(serviceName, name, versionId, option)
      return true
    } catch (ex) {
      throw new Error(ex.message)
    }
  }
}

class Version {
  constructor (credentials, region) {
    this.accountId = credentials.AccountID
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region
    this.fcClient = new FC(credentials.AccountID, {
      accessKeyID: credentials.AccessKeyID,
      accessKeySecret: credentials.AccessKeySecret,
      region: region,
      timeout: 60000
    })
  }

  async publish (serviceName, description) {
    try {
      await this.fcClient.publishVersion(serviceName, description)
      return true
    } catch (ex) {
      return ex.message
    }
  }

  async list (serviceName) {
    try {
      return await this.fcClient.listVersions(serviceName)
    } catch (ex) {
      return ex.message
    }
  }

  async delete (serviceName, versionId) {
    try {
      await this.fcClient.deleteVersion(serviceName, versionId)
      return true
    } catch (ex) {
      return ex.message
    }
  }
}

module.exports = {
  Alias,
  Version
}
