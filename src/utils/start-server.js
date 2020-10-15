const express = require('express')
const { execSync } = require('child_process')

class StartService {
  /**
   *
   * @param {*} context
   * callback 必填，回掉函数
   * port 选填，端口号
   * openBrowser 选填，是否自动打开浏览器
   */
  constructor (context) {
    this.context = context || {}
    this.app = express()
    this.counter = 0
  }

  randomNum () {
    return 3000 + Math.round(Math.random() * 2000)
  }

  start () {
    this.port = this.context.port || 3000
    this.context.callback(this.app)
    this.listen()
  }

  async listen () {
    this.counter += 1
    this.server = this.app.listen(this.port, () => {
      const uri = `http://localhost:${this.port}`

      console.log(`Uri: ${uri}`)

      if (this.context.openBrowser) {
        const startInstruction = process.platform === 'win32' ? 'start' : 'open'
        execSync(`${startInstruction} ${uri}`)
      }
    })

    this.server.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (this.counter < 5) {
          this.port = this.randomNum()
          this.listen()
        } else {
          console.error(e)
        }
      }
    })
  }

  async stop () {
    this.server.close()
  }
}

module.exports = StartService
