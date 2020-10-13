'use strict'
const _ = require('lodash')

const fs = require('fs-extra')
const path = require('path')

const { red } = require('colors')

// TODO: python runtime .egg-info and .dist-info
const runtimeTypeMapping = {
  nodejs6: ['node_modules', '.fun/root'],
  nodejs8: ['node_modules', '.fun/root'],
  nodejs10: ['node_modules', '.fun/root'],
  nodejs12: ['node_modules', '.fun/root'],
  'python2.7': ['.fun/python', '.fun/root'],
  python3: ['.fun/python', '.fun/root'],
  'php7.2': ['extension', 'vendor', '.fun/root']
}

async function detectLibraryFolders (dirName, libraryFolders, wrap, functionName) {
  if (_.isEmpty(libraryFolders)) { return }

  for (const libraryFolder of libraryFolders) {
    const libraryPath = path.join(dirName, libraryFolder)
    if (await fs.pathExists(libraryPath)) {
      console.warn(red(`${wrap}Fun detected that the library directory '${libraryFolder}' is not included in function '${functionName}' CodeUri.\n\t\tPlease make sure if it is the right configuration. if yes, ignore please.`))
      return
    }
  }
}

async function detectLibrary (codeUri, runtime, baseDir = process.cwd(), functionName, wrap = '') {
  const absoluteCodePath = path.resolve(baseDir, codeUri)

  const stats = await fs.lstat(absoluteCodePath)
  if (stats.isFile()) {
    const libraryFolders = runtimeTypeMapping[runtime]

    await detectLibraryFolders(path.dirname(absoluteCodePath), libraryFolders, wrap, functionName)
  }
}

module.exports = {
  detectLibrary
}
