const { Log } = require('@serverless-devs/s-core')

class Logger extends Log {
  log (message, option = {}) {
    option = Object.assign(option, { num: 0 })
    super.log(message, option)
  }

  info (message, option = {}) {
    option = Object.assign(option, { num: 0 })
    super.info(message, option)
  }

  warn (message, option = {}) {
    option = Object.assign(option, { num: 0 })
    super.warn(message, option)
  }

  error (message, option = {}) {
    option = Object.assign(option, { num: 0 })
    super.error(message, option)
  }

  success (message, option = {}) {
    option = Object.assign(option, { num: 0 })
    super.success(message, option)
  }
}

module.exports = Logger
