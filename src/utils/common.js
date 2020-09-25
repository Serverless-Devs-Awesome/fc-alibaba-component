'use strict'

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

module.exports = {
  sleep, promiseRetry
}
