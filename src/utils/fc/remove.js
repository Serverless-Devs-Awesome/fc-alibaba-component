
const FcFunction = require('./function')
const FcTrigger = require('./trigger')
const { FUN_NAS_FUNCTION } = require('../nas/nas')
const { yellow } = require('colors')

class Remove {
    constructor (credentials, region) {
        this.credentials = credentials
        this.region = region
    }

    async removeNasFunctionIfExists (serviceName) {
        const fcFunction = new FcFunction(this.credentials, this.region)
        const existsNasFunction = await fcFunction.functionExists(serviceName, FUN_NAS_FUNCTION)
        if (!existsNasFunction) {
            return
        }

        const fcTrigger = new FcTrigger(this.credentials, this.region)
        try {
            await fcTrigger.remove(serviceName, FUN_NAS_FUNCTION)
        } catch (e) {
            console.log(yellow(`Unable to remove trigger for ${FUN_NAS_FUNCTION}`))
        }

        try {
            await fcFunction.remove(serviceName, FUN_NAS_FUNCTION)
            console.log(`Remove function for NAS successfuly: ${FUN_NAS_FUNCTION}`)
        } catch (e) {
            console.log(yellow(`Unable to remove function: ${FUN_NAS_FUNCTION}`))
        }
    }
}

module.exports = Remove