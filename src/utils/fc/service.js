const FC = require('@alicloud/fc2')
const { DEFAULT } = require('./static')
const RAM = require('../ram')

class Service {
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
    this.ramClient = new RAM(credentials)
  }

  /**
   * Remove service
   * @param {*} serviceName
   */
  async remove (serviceName) {
    try {
      console.log(`Deleting service ${serviceName}`)
      await this.fcClient.deleteService(serviceName)
      console.log(`Delete service ${serviceName} successfully`)
    } catch (err) {
      throw new Error(`Unable to delete function ${serviceName}: ${err.message}`)
    }
  }

  async deploy (properties, state) {
    const serviceInput = properties.Service ? properties.Service : undefined
    const serviceState = state.Service ? state.Service : undefined
    const serviceProperties = {
      serviceName: serviceInput.Name
        ? serviceInput.Name
        : serviceState.Name
          ? serviceState.Name
          : DEFAULT.Service
    }

    console.log(`Deploying service ${serviceProperties.serviceName}.`)

    if (serviceInput.Description) {
      serviceProperties.description = serviceInput.Description
    }
    if (serviceInput.InternetAccess) {
      serviceProperties.internetAccess = serviceInput.InternetAccess
    }
    if (serviceInput.Role) {
      serviceProperties.role = serviceInput.Role
    }
    if (serviceInput.Vpc) {
      serviceProperties.vpcConfig = {
        securityGroupId: serviceInput.Vpc.SecurityGroupId,
        vSwitchIds: serviceInput.Vpc.VSwitchIds,
        vpcId: serviceInput.Vpc.VpcId
      }
    }
    if (serviceInput.Log) {
      serviceProperties.logConfig = {
        logstore: serviceInput.Log.LogStore,
        project: serviceInput.Log.Project
      }
    }
    if (serviceInput.Nas) {
      const mountPoints = []
      for (let i = 0; i < serviceInput.Nas.MountPoints.length; i++) {
        mountPoints.push({
          serverAddr: serviceInput.Nas.MountPoints[i].ServerAddr,
          mountDir: serviceInput.Nas.MountPoints[i].MountDir
        })
      }
      serviceProperties.nasConfig = {
        userId: serviceInput.Nas.UserId,
        groupId: serviceInput.Nas.GroupId,
        mountPoints: mountPoints
      }
    }

    if (!serviceProperties.role) {
      const defaultRoleName = 'ServerlessToolDefaultRole'
      const registryReadOnlyPolicyName = 'AliyunContainerRegistryReadOnlyAccess'
      try {
        console.log(`Checking whether exists default role: ${defaultRoleName}...`)
        const existsDefaultRole = await this.ramClient.existsRole(defaultRoleName)
        if (!existsDefaultRole) {
          await this.createRole(defaultRoleName)
          await this.attachPolicyToRole(registryReadOnlyPolicyName, defaultRoleName)
        }
        serviceProperties.role = `acs:ram::${
          this.accountId
        }:role/${defaultRoleName.toLocaleLowerCase()}`
      } catch (e) {
        console.log(e)
        throw e
      }
    }

    try {
      await this.fcClient.getService(serviceProperties.serviceName)
      try {
        console.log(`Service: ${serviceProperties.serviceName} updating ...`)
        await this.fcClient.updateService(serviceProperties.serviceName, serviceProperties)
      } catch (ex) {
        throw new Error(`${serviceProperties.serviceName} update failed: ${ex.message}`)
      }
    } catch (e) {
      try {
        console.log(`Service: ${serviceProperties.serviceName} creating ...`)
        await this.fcClient.createService(serviceProperties.serviceName, serviceProperties)
      } catch (ex) {
        throw new Error(`${serviceProperties.serviceName} create failed: ${ex.message}`)
      }
    }

    console.log(`Deployment service ${serviceProperties.serviceName} successful.`)

    return serviceProperties.serviceName
  }

  async createRole (defaultRoleName) {
    console.log(`going to create role ${defaultRoleName}...`)
    try {
      const role = await this.ramClient.makeRole(
        defaultRoleName,
        true,
        'Serverless Tool default role'
      )
      if (role) {
        return defaultRoleName
      }
      throw new Error('Failed to create role')
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  async attachPolicyToRole (policyName, roleName) {
    console.log('Attaching AliyunContainerRegistryReadOnlyAccess to default role...')
    try {
      await this.ramClient.attachPolicyToRole(policyName, roleName)
    } catch (e) {
      console.log(e)
      throw e
    }
  }
}

module.exports = Service
