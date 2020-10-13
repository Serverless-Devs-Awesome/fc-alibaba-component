'use strict'

const _ = require('lodash')

const DEFAULT_RETRIES = 3

const retry = require('promise-retry')

async function getRetryOptions () {
  const retryOptions = {
    retries: DEFAULT_RETRIES,
    factor: 2,
    minTimeout: 1 * 1000,
    randomize: true
  }

  return retryOptions
}

function promiseRetry (fn) {
  const retryOptions = getRetryOptions()
  return retry(fn, retryOptions)
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function asyncFind (pathArrays, filter) {
  for (const path of pathArrays) {
    if (await filter(path)) {
      return path
    }
  }
  return null
}

function syncFind (pathArrays, filter) {
  for (const path of pathArrays) {
    if (filter(path)) {
      return path
    }
  }
  return null
}

function hasOwnProperty (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function isDotnetcoreRuntime (runtime) {
  return runtime.indexOf('dotnetcore') > -1
}

function isFalseValue (val) {
  return val && (_.toLower(val) === 'false' || val === '0')
}

module.exports = {
  sleep,
  promiseRetry,
  isDotnetcoreRuntime,
  isFalseValue,
  asyncFind,
  syncFind,
  hasOwnProperty
}
