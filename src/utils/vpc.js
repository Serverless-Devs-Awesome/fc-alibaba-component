'use strict'

const vswitch = require('./vswitch')
const securityGroup = require('./security-group')
const debug = require('debug')('fun:nas')
const { sleep } = require('./common')
const { getVpcPopClient, getEcsPopClient } = require('./client')
const inquirer = require('inquirer')
const _ = require('lodash')
const Logger = require('./logger')
const logger = new Logger()

// const TEN_SPACES = '          '

var requestOption = {
  method: 'POST'
}

const defaultVpcName = 'fc-fun-vpc'
const defaultVSwitchName = 'fc-fun-vswitch-1'
const defaultSecurityGroupName = 'fc-fun-sg-1'

async function findVpc (vpcClient, region, vpcName) {
  const pageSize = 50 // max value is 50. see https://help.aliyun.com/document_detail/104577.html
  let requestPageNumber = 0
  let totalCount
  let pageNumber

  let vpc

  do {
    var params = {
      RegionId: region,
      PageSize: pageSize,
      PageNumber: ++requestPageNumber
    }

    const rs = await vpcClient.request('DescribeVpcs', params, requestOption)

    totalCount = rs.TotalCount
    pageNumber = rs.PageNumber
    const vpcs = rs.Vpcs.Vpc

    debug('find vpc rs: %s', rs)

    vpc = _.find(vpcs, { VpcName: vpcName })

    debug('find default vpc: %s', vpc)
  } while (!vpc && totalCount && pageNumber && pageNumber * pageSize < totalCount)

  return vpc
}

async function createVpc (vpcClient, region, vpcName) {
  var createParams = {
    RegionId: region,
    CidrBlock: '10.0.0.0/8',
    EnableIpv6: false,
    VpcName: vpcName,
    Description: 'default vpc created by fc fun'
  }

  var createRs

  try {
    createRs = await vpcClient.request('CreateVpc', createParams, requestOption)
  } catch (ex) {
    throw new Error(`error when create Vpc:\n${ex}`)
  }

  const vpcId = createRs.VpcId

  debug('create vpc rs is: %j', createRs)

  await waitVpcUntilAvaliable(vpcClient, region, vpcId)

  return vpcId
}

async function deleteDefaultVpcAndSwitch (credentials, region, forceDelete = false) {
  const vpcClient = await getVpcPopClient(credentials)
  const funDefaultVpc = await findVpc(vpcClient, region, defaultVpcName)
  if (!funDefaultVpc) {
    return
  }
  const vswitchIds = funDefaultVpc.VSwitchIds.VSwitchId
  const vpcId = funDefaultVpc.VpcId

  const vswitchId = await vswitch.findVswitchExistByName(vpcClient, region, vswitchIds, defaultVSwitchName)
  if (!vswitchId) {
    return
  }

  logger.info(`Found auto generated vpc: ${vpcId} and vswitch: ${vswitchId}`)
  if (!forceDelete) {
    const { deleteVpcAndSwitch } = await inquirer.prompt([{
      type: 'confirm',
      name: 'deleteVpcAndSwitch',
      default: false,
      message: `Do you want to delete vpc ${vpcId} and vswitch ${vswitchId}?`
    }])
    forceDelete = deleteVpcAndSwitch
  }

  if (forceDelete) {
    await vswitch.deleteVSwitch(vpcClient, region, vswitchId)
    deleteVpc(vpcClient, region, vpcId)
  }
}

async function deleteVpc (vpcClient, region, vpcId) {
  const params = {
    RegionId: region,
    VpcId: vpcId
  }
  await vpcClient.request('DeleteVpc', params, requestOption)
}

async function waitVpcUntilAvaliable (vpcClient, region, vpcId) {
  let count = 0
  let status

  do {
    count++

    var params = {
      RegionId: region,
      VpcId: vpcId
    }

    await sleep(1000)

    const rs = await vpcClient.request('DescribeVpcs', params, requestOption)
    const vpcs = rs.Vpcs.Vpc
    if (vpcs && vpcs.length) {
      status = vpcs[0].Status

      debug('vpc status is: ' + status)

      logger.info(`VPC already created, waiting for status to be 'Available', the status is ${status} currently`)
    }
  } while (count < 15 && status !== 'Available')

  if (status !== 'Available') { throw new Error(`Timeout while waiting for vpc ${vpcId} status to be 'Available'`) }
}

async function createDefaultVSwitchIfNotExist (credentials, vpcClient, region, vpcId, vswitchIds) {
  let vswitchId = await vswitch.findVswitchExistByName(vpcClient, region, vswitchIds, defaultVSwitchName)

  if (!vswitchId) { // create vswitch
    logger.info('Generating default vswitch')
    vswitchId = await vswitch.createDefaultVSwitch(credentials, vpcClient, region, vpcId, defaultVSwitchName)
    logger.success('Default vswitch has been generated, vswitchId is: ' + vswitchId)
  } else {
    logger.info('Vswitch already exists, vswitchId is: ' + vswitchId)
  }
  return vswitchId
}

async function createDefaultSecurityGroupIfNotExist (ecsClient, region, vpcId) {
  // check fun default security group exist?
  const defaultSecurityGroup = await securityGroup.describeSecurityGroups(ecsClient, region, vpcId, defaultSecurityGroupName)
  debug('default security grpup: %j', defaultSecurityGroup)

  // create security group
  if (_.isEmpty(defaultSecurityGroup)) {
    logger.info('Generating default security group')
    const securityGroupId = await securityGroup.createSecurityGroup(ecsClient, region, vpcId, defaultSecurityGroupName)

    logger.success(`Default security group generated, securityGroupId is: ${securityGroupId}`)
    logger.info('Generating default security group rules')
    await securityGroup.authDefaultSecurityGroupRules(ecsClient, region, securityGroupId)
    logger.info('Security group rules generated')

    return securityGroupId
  }

  const securityGroupId = defaultSecurityGroup[0].SecurityGroupId
  logger.info('Security group already exists, security group is: ' + securityGroupId)
  return securityGroupId
}

async function createDefaultVpcIfNotExist (credentials, region) {
  const vpcClient = await getVpcPopClient(credentials)
  const ecsClient = await getEcsPopClient(credentials)

  // const defaultVpcName = 'fc-fun-vpc'

  let vswitchIds
  let vpcId

  const funDefaultVpc = await findVpc(vpcClient, region, defaultVpcName)

  if (funDefaultVpc) { // update
    vswitchIds = funDefaultVpc.VSwitchIds.VSwitchId
    vpcId = funDefaultVpc.VpcId

    logger.info('Vpc already exists, vpcId is: ' + vpcId)
  } else { // create
    logger.info('Generating default vpc')
    vpcId = await createVpc(vpcClient, region, defaultVpcName)
    logger.success('Default vpc has been generated, vpcId is: ' + vpcId)
  }

  debug('vpcId is %s', vpcId)
  const vswitchId = await createDefaultVSwitchIfNotExist(credentials, vpcClient, region, vpcId, vswitchIds)

  vswitchIds = [vswitchId]
  // create security
  const securityGroupId = await createDefaultSecurityGroupIfNotExist(ecsClient, region, vpcId)

  return {
    vpcId,
    vswitchIds,
    securityGroupId
  }
}

async function findDefaultVpcAndSwitch (credentials, region) {
  const vpcClient = await getVpcPopClient(credentials)
  const funDefaultVpc = await findVpc(vpcClient, region, defaultVpcName)
  if (funDefaultVpc) {
    const vswitchIds = funDefaultVpc.VSwitchIds.VSwitchId
    const vpcId = funDefaultVpc.VpcId
    const vswitchId = await vswitch.findVswitchExistByName(vpcClient, region, vswitchIds, defaultVSwitchName)
    return {
      vpcId,
      vswitchId
    }
  }
  return {}
}

module.exports = {
  createDefaultVpcIfNotExist,
  deleteDefaultVpcAndSwitch,
  findDefaultVpcAndSwitch,
  findVpc,
  createVpc
}
