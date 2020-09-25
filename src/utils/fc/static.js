'use strict'

const DEFAULT = {
  Service: 'Default',
  Region: 'cn-hangzhou',
  Runtime: 'nodejs10',
  Handler: 'index.handler'
}

const DEFAULT_VPC_CONFIG = {
  securityGroupId: '',
  vSwitchIds: [],
  vpcId: ''
}

const DEFAULT_NAS_CONFIG = {
  UserId: -1,
  GroupId: -1,
  MountPoints: []
}

const FUN_GENERATED_SERVICE = 's-generated-default-service'

module.exports = {
  DEFAULT, DEFAULT_VPC_CONFIG, DEFAULT_NAS_CONFIG, FUN_GENERATED_SERVICE
}
