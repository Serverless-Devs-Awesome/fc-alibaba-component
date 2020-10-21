'use strict'

const Client = require('./client')
const Logger = require('../logger')

class Alias extends Client {
  constructor (credentials, region) {
    super(credentials, region)
    this.fcClient = this.buildFcClient()
    this.logger = new Logger()
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
      this.logger.info(`Create alias: ${name}`)
      await this.fcClient.createAlias(serviceName, name, versionId, option)
      this.logger.success(`Create alias successfully: ${name}`)
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
      this.logger.info(`Delete alias: ${aliasName}`)
      await this.fcClient.deleteAlias(serviceName, aliasName)
      this.logger.success(`Delete alias successfully: ${aliasName}`)
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
      this.logger.info(`Update alias: ${name}`)
      await this.fcClient.updateAlias(serviceName, name, versionId, option)
      this.logger.success(`Update alias successfully: ${name}`)
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
    this.logger = new Logger()
  }

  async publish (serviceName, description) {
    try {
      this.logger.info('Publish version.')
      const { data } = await this.fcClient.publishVersion(serviceName, description)
      this.logger.success(`Publish version successfully: ${data.versionId}`)
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
      this.logger.info(`Deleting version: ${versionId}`)
      await this.fcClient.deleteVersion(serviceName, versionId)
      this.logger.success(`Delete version successfully: ${versionId}`)
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
