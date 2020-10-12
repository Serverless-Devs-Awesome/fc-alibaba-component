const Service = require('./service')
const Trigger = require('./trigger')
const FcFunction = require('./function')
const InvokeRemote = require('./invokeRemote')
const Sync = require('./sync')

const { CustomDomain, GetAutoDomain } = require('./customDomain')
const { Alias, Version } = require('./qualifier')

module.exports = {
  Service,
  FcFunction,
  Trigger,
  Version,
  Alias,
  CustomDomain,
  GetAutoDomain,
  Sync,
  InvokeRemote
}
