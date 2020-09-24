const FC = require('@alicloud/fc2')
const fs = require('fs')
const requestP = require('request-promise')
const _ = require('lodash')

class CustomDomain {
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

  async deployDomain (domain, ServiceName, FunctionName) {
    let domainName = domain.Domain
    const tempProtocol = domain.Protocol || ['HTTP']
    const tempRouteConfig = domain.Routes || []
    const certConfig = domain.CertConfig

    let protocol = ''
    if (tempProtocol.length === 1) {
      protocol = tempProtocol[0]
    } else {
      protocol = tempProtocol[0]
      for (let i = 1; i < tempProtocol.length; i++) {
        protocol = protocol + ',' + tempProtocol[i]
      }
    }

    const options = {
      protocol
    }

    const routeConfig = {
      routes: tempRouteConfig.map((item) => ({
        ...item,
        ServiceName,
        FunctionName
      }))
    }

    if (domainName.toLocaleUpperCase() === 'AUTO') {
      const getAutoDomain = new GetAutoDomain(
        this.accountId,
        this.accessKeyID,
        this.accessKeySecret,
        this.region
      )
      const autoDomain = await getAutoDomain.getCustomAutoDomainName(ServiceName, FunctionName, true)
      domainName = autoDomain.domainName
      options.protocol = 'HTTP'
      if (!domainName) {
        console.error('获取临时域名失败')
        return false
      }

      Object.assign(options, {
        routeConfig: tempRouteConfig.length ? routeConfig : autoDomain.routeConfig
      })
    } else {
      Object.assign(options, {
        routeConfig
      })

      if (!_.isEmpty(certConfig)) {
        const privateKey = certConfig.PrivateKey
        const certificate = certConfig.Certificate

        if (privateKey && privateKey.endsWith('.pem')) {
          certConfig.PrivateKey = await fs.readFile(privateKey, 'utf-8')
        }
        if (certificate && certificate.endsWith('.pem')) {
          certConfig.Certificate = await fs.readFile(certificate, 'utf-8')
        }
        Object.assign(options, {
          certConfig
        })
      }
    }

    try {
      await this.fcClient.getCustomDomain(domainName)
      // 升级自定义域名
      try {
        await this.fcClient.updateCustomDomain(domainName, options)
        return domainName
      } catch (e) { }
    } catch (e) {
      // 新建自定义域名
      for (let i = 0; i <= 50; i++) {
        try {
          await this.fcClient.createCustomDomain(domainName, options)
          return domainName
        } catch (ex) {
          this.sleep(1000)
        }
      }
    }
    return domainName
  }

  sleep (ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async deploy (domains, ServiceName, FunctionName, onlyDomainName) {
    const domainNames = []
    for (let i = 0; i < domains.length; i++) {
      if (onlyDomainName && onlyDomainName !== domains[i].Domain) {
        continue
      }
      const domainName = await this.deployDomain(domains[i], ServiceName, FunctionName)
      domainNames.push(domainName)
    }
    return domainNames
  }

  async remove (domains, ServiceName, FunctionName, onlyDomainName) {
    const deleteDomain = async (domainName) => {
      console.log(`Deleting domain: ${domainName}`)
      try {
        await this.fcClient.deleteCustomDomain(domainName)
      } catch(e) {
        if (e.code !== 'DomainNameNotFound') {
          throw new Error(e.message);
        }
      }
      console.log(`Delete domain successfully: ${domainName}`)
    }

    if (onlyDomainName) {
      await deleteDomain(onlyDomainName);
      return;
    }
    for (const { Domain } of domains) {
      if (Domain.toLocaleUpperCase() === 'AUTO') {
        const getAutoDomain = new GetAutoDomain(
          this.accountId,
          this.accessKeyID,
          this.accessKeySecret,
          this.region
        )
        const autoDomain = await getAutoDomain.getCustomAutoDomainName(ServiceName, FunctionName)
        await deleteDomain(autoDomain);
      } else {
        await deleteDomain(Domain);
      }
    }
  }
}

class GetAutoDomain {
  constructor (accountId, accessKeyID, accessKeySecret, region) {
    this.accountId = accountId
    this.accessKeyID = accessKeyID
    this.accessKeySecret = accessKeySecret
    this.region = region
    this.fcClient = new FC(accountId, {
      accessKeyID: accessKeyID,
      accessKeySecret: accessKeySecret,
      region: region,
      timeout: 60000
    })
  }

  async deleteFcUtilsFunctionTmpDomain ({ tmpServiceName, tmpFunctionName, tmpTriggerName }) {
    try {
      await this.fcClient.deleteTrigger(tmpServiceName, tmpFunctionName, tmpTriggerName)
    } catch (e) {}
    try {
      await this.fcClient.deleteFunction(tmpServiceName, tmpFunctionName, tmpTriggerName)
    } catch (e) {}
    try {
      await this.fcClient.deleteService(tmpServiceName)
    } catch (e) {}
  }

  async makeFcUtilsFunctionTmpDomainToken (token) {
    const tmpServiceName = 'fc-domain-challenge'
    try {
      await this.fcClient.createService(tmpServiceName, {
        description: 'generated by Funcraft for authentication',
        vpcConfig: {},
        nasConfig: {}
      })
    } catch (e) {}
    const functionCode = `'use strict';

module.exports.handler = function (request, response, context) {

  const functionName = context.function.name;

  response.setStatusCode(200);
  response.setHeader('content-type', 'application/json');
  response.send(functionName.slice(3));
};`

    const tmpFunctionName = `fc-${token}`
    const JSZip = require('jszip')
    const zip = new JSZip()
    zip.file('index.js', functionCode)

    const zipFile = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      platform: 'UNIX'
    })

    try {
      await this.fcClient.createFunction(tmpServiceName, {
        functionName: tmpFunctionName,
        code: { zipFile },
        runtime: 'nodejs8',
        description: 'used for tmp domain service to authenticate.',
        handler: 'index.handler'
      })
    } catch (e) {}

    const tmpTriggerName = 'tmp-domain-http'

    const triggerProperties = {
      AuthType: 'anonymous',
      Methods: ['GET', 'POST', 'PUT']
    }

    try {
      await this.fcClient.createTrigger(tmpServiceName, tmpFunctionName, {
        triggerName: tmpTriggerName,
        triggerType: 'http',
        triggerConfig: triggerProperties
      })
    } catch (e) {}

    return {
      tmpServiceName,
      tmpFunctionName,
      tmpTriggerName
    }
  }

  async processTemporaryDomain () {
    const TMP_DOMAIN_URL =
      'https://1813774388953700.cn-shanghai.fc.aliyuncs.com/2016-08-15/proxy/generate_tmp_domain_for_console.prod/generate_preview_domain_for_fun/'
    const { token } = await sendHttpRequest('POST', TMP_DOMAIN_URL, {
      accountID: this.accountId,
      region: this.region
    })
    const cacheFunctionConfig = await this.makeFcUtilsFunctionTmpDomainToken(token)

    try {
      const domainRs = await sendHttpRequest('POST', TMP_DOMAIN_URL, {
        accountID: this.accountId,
        region: this.region,
        token
      })
      await this.deleteFcUtilsFunctionTmpDomain(cacheFunctionConfig)
      return domainRs.domain
    } catch (e) {
      await this.deleteFcUtilsFunctionTmpDomain(cacheFunctionConfig)
      console.warn(e.message)
    }
  }

  async getTmpDomainExpiredTime (domainName) {
    const TMP_DOMAIN_EXPIRED_TIME_URL =
      'https://1813774388953700.cn-shanghai.fc.aliyuncs.com/2016-08-15/proxy/generate_tmp_domain_for_console/get_expired_time/'
    const expiredTimeRs = await sendHttpRequest('POST', TMP_DOMAIN_EXPIRED_TIME_URL, {
      domain: domainName
    })

    const expiredTime = expiredTimeRs.expired_time
    const timesLimit = expiredTimeRs.times_limit
    const expiredTimeObj = new Date(expiredTime * 1000)

    return {
      expiredTime,
      timesLimit,
      expiredTimeObj
    }
  }

  async listCustomDomains () {
    const rs = await this.fcClient.listCustomDomains()
    return rs.data.customDomains
  }

  async getCustomAutoDomainName (serviceName, functionName, isGenerate = false) {
    const customDomains = await this.listCustomDomains()
    const tmpDomains = isGenerate ? customDomains.filter((f) => {
      return f.domainName.endsWith('.test.functioncompute.com')
    }) : customDomains

    const routesToCase = async (routes) => {
      const data = []
      for (const i of routes) {
        data.push({
          Path: i.path,
          ServiceName: i.serviceName,
          FunctionName: i.functionName,
          Qualifier: i.qualifier
        })
      }
      return data
    }

    for (const tmpDomain of tmpDomains) {
      const { routes } = tmpDomain.routeConfig
      const tmpDomainName = tmpDomain.domainName
      // const { protocol } = tmpDomain
      if (!routes) {
        continue
      }

      for (const route of routes) {
        if (serviceName === route.serviceName && functionName === route.functionName) {
          if (!isGenerate) {
            return tmpDomainName;
          }
          const { expiredTime } = await this.getTmpDomainExpiredTime(
            tmpDomainName
          )

          if (expiredTime > Math.round(new Date().getTime() / 1000)) {
            return {
              routeConfig: {
                routes: routesToCase(routes)
              },
              domainName: tmpDomainName
            }
          }
        }
      }
    }
    if (!isGenerate) {
      return false;
    }
    const domainName = await this.processTemporaryDomain()
    const routeConfig = {
      routes: [
        {
          Path: '/*',
          ServiceName: serviceName,
          FunctionName: functionName,
          Qualifier: 'LATEST'
        }
      ]
    }
    return { domainName, routeConfig }
  }
}

async function sendHttpRequest (method, url, requestData) {
  return await requestP({
    method,
    uri: url,
    body: requestData,
    json: true
  })
}

module.exports = {
  CustomDomain,
  GetAutoDomain
}
