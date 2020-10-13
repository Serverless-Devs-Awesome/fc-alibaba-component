'use strict'

const Sync = require('./sync')
const Service = require('./service')
const Trigger = require('./trigger')
const FcFunction = require('./function')

const { Alias, Version } = require('./qualifier')
const { CustomDomain, GetAutoDomain } = require('./customDomain')

module.exports = {
  Service,
  FcFunction,
  Trigger,
  Version,
  Alias,
  CustomDomain,
  GetAutoDomain,
  Sync
}
