const Logger = require('./logger')

const ROAClient = require('@alicloud/pop-core').ROAClient

class AliyunContainerRegistry {
  constructor (credentials, region) {
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region
    this.client = new ROAClient({
      accessKeyId: this.accessKeyID,
      accessKeySecret: this.accessKeySecret,
      endpoint: `https://cr.${this.region}.aliyuncs.com`,
      apiVersion: '2016-06-07'
    })
    this.logger = new Logger()
  }

  async getAuthorizationToken () {
    const httpMethod = 'GET'
    const uriPath = '/tokens'
    const queries = {}
    const body = '{}'
    const headers = {
      'Content-Type': 'application/json'
    }
    const requestOption = {}
    const response = await this.client.request(httpMethod, uriPath, queries, body, headers, requestOption)
    return {
      User: response.data.tempUserName,
      Password: response.data.authorizationToken
    }
  }

  async ensureNamespace (namespace) {
    if (await this.namespaceExists(namespace)) {
      this.logger.info(`Namespace ${namespace} already exists`)
      return
    }

    let response
    try {
      response = await this.createNamespace(namespace)
      if (response && response.data && response.data.namespaceId) {
        this.logger.success(`Create namespace:${namespace} successfully.`)
        return
      }
    } catch (e) {
      if (e.result) {
        this.logger.error(`Failed to create namespace, code:${e.result.code}, message:${e.result.message}`)
      } else {
        this.logger.error(JSON.stringify(e))
      }

      throw new Error('Create namespace failed.')
    }

    throw new Error(`Failed to create namespace:${namespace}, respones: ` + response)
  }

  async namespaceExists (namespace) {
    const httpMethod = 'GET'
    const uriPath = `/namespace/${namespace}`
    const queries = {}
    const body = '{}'
    const headers = {
      'Content-Type': 'application/json'
    }
    const requestOption = {}
    try {
      const response = await this.client.request(httpMethod, uriPath, queries, body, headers, requestOption)
      return response && response.data && response.data.namespace
    } catch (e) {
      if (e.result && e.result.code === 'NAMESPACE_NOT_EXIST') {
        return false
      }

      throw e
    }
  }

  async createNamespace (namespace) {
    const httpMethod = 'PUT'
    const uriPath = '/namespace'
    const queries = {}
    const body = `{
            "Namespace": {
                "Namespace": "${namespace}",
            }
        }`
    const headers = {
      'Content-Type': 'application/json'
    }
    const requestOption = {}
    const response = await this.client.request(httpMethod, uriPath, queries, body, headers, requestOption)
    return response
  }
}

module.exports = AliyunContainerRegistry
