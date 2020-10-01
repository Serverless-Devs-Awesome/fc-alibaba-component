'use strict'

const Client = require('./client')

class Alias extends Client {
  constructor (credentials, region) {
    super(credentials, region)
    this.fcClient = this.buildFcClient()
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
      console.log(`Create alias: ${name}`)
      await this.fcClient.createAlias(serviceName, name, versionId, option)
      console.log(`Create alias successfully: ${name}`)
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
      console.log(`Delete alias: ${aliasName}`)
      await this.fcClient.deleteAlias(serviceName, aliasName)
      console.log(`Delete alias successfully: ${aliasName}`)
      return true
    } catch (ex) {
      throw new Error(ex.message)
    }
  }

  async update (alias, serviceName) {
    const name = alias.Name
    const versionId = alias.Version
    const option = {}
    option.description = alias.Description
    option.additionalVersionWeight = alias.additionalVersionWeight

    try {
      console.log(`Update alias: ${name}`)
      await this.fcClient.updateAlias(serviceName, name, versionId, option)
      console.log(`Update alias successfully: ${name}`)
      return true
    } catch (ex) {
      throw new Error(ex.message)
    }
  }
}

class Version extends Client {
  constructor (credentials, region) {
    super(credentials, region)
    this.fcClient = this.buildFcClient()
  }

  async publish (serviceName, description) {
    try {
      console.log('Publish version.')
      const { data } = await this.fcClient.publishVersion(serviceName, description)
      console.log(`Publish version successfully: ${data.versionId}`)
      return true
    } catch (ex) {
      throw new Error(ex.message)
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
      console.log(`Deleting version: ${versionId}`)
      await this.fcClient.deleteVersion(serviceName, versionId)
      console.log(`Delete version successfully: ${versionId}`)
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
