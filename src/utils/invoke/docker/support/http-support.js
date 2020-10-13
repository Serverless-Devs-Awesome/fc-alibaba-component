'use strict'

const _ = require('lodash')

const debug = require('debug')('local:start')
const HttpInvoke = require('../http-invoke')
// const ApiInvoke = require('../../local/api-invoke');

const { ensureTmpDir } = require('../../../path')
const { detectLibrary } = require('./common')
const { green, yellow } = require('colors')
const { setCORSHeaders } = require('./cors')

class HttpSupport {
  constructor (credentials) {
    this.credentials = credentials
  }

  async registerHttpTriggers (serviceName, serviceProps, functionName, functionProps, app, router, serverPort, httpTriggers, debugPort, debugIde, baseDir, debuggerPath, debugArgs, nasBaseDir, tplPath) {
    for (const httpTrigger of httpTriggers) {
      await this.registerSingleHttpTrigger(serviceName, serviceProps, functionName, functionProps, app, router, serverPort, httpTrigger, debugPort, debugIde, baseDir, false, debuggerPath, debugArgs, nasBaseDir, tplPath)
    }
    console.log()
  }

  async registerSingleHttpTrigger (serviceName, serviceProps, functionName, functionProps, app, router, serverPort, httpTrigger, debugPort, debugIde, baseDir, eager = false, debuggerPath, debugArgs, nasBaseDir, tplPath) {
    const { triggerName, Parameters: triggerProps, path, domainName } = httpTrigger

    const isCustomDomain = path

    const httpTriggerPrefix = `/2016-08-15/proxy/${serviceName}/${functionName}`
    const customDomainPrefix = path

    const endpointForRoute = isCustomDomain ? customDomainPrefix : `${httpTriggerPrefix}*`

    let endpointForDisplay = endpointForRoute
    if (_.endsWith(endpointForDisplay, '*')) {
      endpointForDisplay = endpointForDisplay.substr(0, endpointForDisplay.length - 1)
    }

    const endpointPrefix = isCustomDomain ? '' : httpTriggerPrefix

    const httpMethods = triggerProps.Methods
    const authType = triggerProps.AuthType

    const codeUri = functionProps.CodeUri
    const runtime = functionProps.Runtime

    debug('debug port: %d', debugPort)

    await detectLibrary(codeUri, runtime, baseDir, functionName)

    const tmpDir = await ensureTmpDir(null, tplPath, serviceName, functionName)

    const httpInvoke = new HttpInvoke(this.credentials, serviceName, serviceProps, functionName, functionProps, debugPort, debugIde, baseDir, tmpDir, authType, endpointPrefix, debuggerPath, debugArgs, nasBaseDir)

    if (eager) {
      await httpInvoke.initAndStartRunner()
    }

    app.use(setCORSHeaders)
    app.use(router)

    for (const method of httpMethods) {
      router[method.toLowerCase()](endpointForRoute, async (req, res) => {
        if (req.get('Upgrade') === 'websocket') {
          res.status(403).send('websocket not support')
          return
        }
        await httpInvoke.invoke(req, res)
      })
    }
    this.printHttpTriggerTips(serverPort, serviceName, functionName, triggerName, endpointForDisplay, httpMethods, authType, domainName)
  }

  printHttpTriggerTips (serverPort, serviceName, functionName, triggerName, endpoint, httpMethods, authType, domainName) {
    const prefix = domainName ? `CustomDomain ${domainName}` : `HttpTrigger ${triggerName}`
    console.log(green(`${prefix} of ${serviceName}/${functionName} was registered`))
    console.log('\turl: ' + yellow(`http://localhost:${serverPort}${endpoint}`))
    console.log('\tmethods: ' + yellow(httpMethods))
    console.log('\tauthType: ' + yellow(authType))
  }
}

// function logsApi(serverPort, serviceName, functionName, endpoint) {
//   console.log(green(`API ${serviceName}/${functionName} was registered`));
//   console.log('\turl: ' + yellow(`http://localhost:${serverPort}${endpoint}/`));
// }

// async function registerApis(app, serverPort, functions, debugPort, debugIde, baseDir, debuggerPath, debugArgs, nasBaseDir, tplPath) {
//   for (let { serviceName, serviceRes,
//     functionName, functionRes } of functions) {

//     const endpoint = `/2016-08-15/services/${serviceName}/functions/${functionName}/invocations`;

//     const tmpDir = await ensureTmpDir(null, tplPath, serviceName, functionName);

//     const apiInvoke = new ApiInvoke(serviceName, serviceRes, functionName, functionRes, debugPort, debugIde, baseDir, tmpDir, debuggerPath, debugArgs, nasBaseDir);

//     const codeUri = functionRes.Properties.CodeUri;
//     const runtime = functionRes.Properties.Runtime;
//     await detectLibrary(codeUri, runtime, baseDir, functionName);

//     app.post(endpoint, async (req, res) => {
//       apiInvoke.invoke(req, res);
//     });

//     logsApi(serverPort, serviceName, functionName, endpoint);
//   }

//   console.log();
// }

module.exports = HttpSupport
