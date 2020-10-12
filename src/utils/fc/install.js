const path = require('path');
const fs = require('fs-extra');
const fcBuilders = require('@alicloud/fc-builders');
const buildOpts = require('../build/build-opts');
const docker = require('../docker/docker');
const dockerOpts = require('../docker/docker-opts');
const _ = require('lodash');
const ncp = require('../ncp');
const util = require('util');
const ncpAsync = util.promisify(ncp);
const { processorTransformFactory } = require('../error/error-processor');
const {sboxForServerless} = require('../docker/sbox');
const { buildFunction, getOrConvertFunfile, getOrConvertFcfile} = require('../build/build');
const { detectTplPath, getTpl, validateTplName } = require('../tpl/tpl');
const { findFunctionInTpl } = require('../tpl/definition');
const { red } = require('colors');
const { resolveEnv } = require('../build/parser');
const { FunModule } = require('../install/module');
const Context = require('../install/context');
const { AptTask, PipTask, ShellTask } = require('../install/task');
const parser = require('../build/parser');
const nas = require('../nas/nas');
const uuid = require('uuid');
const { yellow } = require('colors');
const { green } = require('colors');
const { DEFAULT_NAS_PATH_SUFFIX } = require('../tpl/tpl');


class Install {
    constructor() {

    }

    // async installAll(serviceName, serviceProps, functionName, functionProps, interactive, useDocker, verbose) {
    //   const codeUri = functionProps.CodeUri;
    //   const baseDir = process.cwd();
    //   const artifactPath = path.resolve(baseDir, codeUri);
    //   const runtime = functionProps.Runtime;

    //   if (! await this.codeNeedInstall(baseDir, codeUri, runtime)) {
    //     return;
    //   }

    //   if (interactive) {
    //     console.log('Now entering docker environment for installing dependency...');
    //     await this.installInteractiveInDocker(functionProps, baseDir, codeUri);
    //     return;
    //   }

    //   if (useDocker) {
    //     //serviceName, serviceProps, functionName, functionProps, codePath, artifactPath, verbose
    //     await this.installInDocker(serviceName, serviceProps, functionName, functionProps, baseDir, artifactPath, artifactPath, verbose);
    //   } else {
    //     await this.installArtifact(serviceName, serviceProps, functionName, functionProps, artifactPath, artifactPath, verbose);
    //   }

    //   await this.collectArtifact(functionProps.Runtime, artifactPath);
    // }

    async installInteractiveInDocker(serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, isInteractive, cmd, envs) {
      const runtime = functionProps.Runtime;
      const imageName = await dockerOpts.resolveRuntimeToDockerImage(runtime, true);
      const absCodeUri = path.resolve(baseDir, codeUri);
      let mounts = [];
      const nasConfig = (serviceProps || {}).Nas; //TODO nahai confirm the nas path
      mounts = await docker.resolveNasConfigToMounts(baseDir, serviceName, nasConfig, nas.getDefaultNasDir(baseDir));
      mounts.push(await docker.resolveCodeUriToMount(absCodeUri, false));
      mounts.push(await docker.resolvePasswdMount());

      await docker.pullImageIfNeed(imageName);
      await docker.startSboxContainer({
        runtime,
        imageName,
        mounts: _.compact(mounts),
        cmd,
        envs,
        isTty: isInteractive && process.stdin.isTTY || false,
        isInteractive
      });
    }

    // [ 'A=B', 'B=C' ] => { A: 'B', B: 'C' }
    convertEnvs = (env) => (env || []).map(e => _.split(e, '=', 2))
    .filter(e => e.length === 2)
    .reduce((acc, cur) => (acc[cur[0]] = cur[1], acc), {});

    findAllTargetsFromTasks(tasks) {
      const targets = [];
      for (const t of tasks) {
        const target = t.attrs.target;
    
        if (target) {
          targets.push(target);
        }
      }
    
      return targets;
    }

    async install({serviceName, serviceProps, functionName, functionProps, cmdArgs = {}}) {
      const codeUri = functionProps.CodeUri;
      const baseDir = process.cwd();
      const absCodeUri = path.resolve(baseDir, codeUri);
      const runtime = functionProps.Runtime;
      //detect fcfile
      const fcfilePath = path.resolve(absCodeUri, 'fcfile');
      if (fs.existsSync(fcfilePath)) {
        console.log(yellow(`Found fcfile in src directory, maybe 's install docker' is better.`));
      }

      const stages = ['install'];
      const builder = new fcBuilders.Builder(serviceName, functionName, absCodeUri, runtime, absCodeUri, false, stages);
      await builder.build();
    }

    /**
     * Docker 构建
     */
    async installInDocker({serviceName, serviceProps, functionName, functionProps, cmdArgs = {}}) {
      const verbose = false;
      const codeUri = functionProps.CodeUri;
      const baseDir = process.cwd();
      const artifactPath = path.resolve(baseDir, codeUri);
      const absCodeUri = path.resolve(baseDir, codeUri);
      const funcArtifactDir = artifactPath;
      const runtime = cmdArgs.runtime || functionProps.Runtime;
      const envs = this.convertEnvs(cmdArgs.env);
      const url = cmdArgs.url;
      //, baseDir, codeUri, funcArtifactDir, verbose
      const stages = ['install'];
      const nasProps = {};

      if (!cmdArgs.installAll) {
        await this.installPackageInDocker(cmdArgs.packages, {
          serviceName,
          serviceProps,
          functionName,
          functionProps,
          runtime,
          isInteractive: false,
          baseDir,
          absCodeUri,
          envs,
          save: cmdArgs.save,
          url,
          packageType: cmdArgs.packageType
        });
        return;
      }

      if (cmdArgs.interactive || cmdArgs.cmd) {
        console.log('Now entering docker environment for installing dependency.');
        //serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, isInteractive, cmd, envs
        await this.installInteractiveInDocker(serviceName, serviceProps, functionName, functionProps, baseDir, codeUri, cmdArgs.interactive, cmdArgs.cmd, envs);
        return;
      }
    
      let imageTag;
      const funfilePath = path.resolve(absCodeUri, cmdArgs.fcFile);
      if (fs.existsSync(funfilePath)) {
        imageTag = await this.processFunfile(serviceName, serviceProps, codeUri, funfilePath, baseDir, funcArtifactDir, runtime, functionName);
      }

      let custom = {};
      if (cmdArgs.env) {
        custom.Env = this.convertEnvs(cmdArgs.env);
      }
      if (cmdArgs.runtime) {
        custom.Runtime = cmdArgs.runtime;
      }
      const opts = await buildOpts.generateBuildContainerBuildOpts(serviceName, 
        serviceProps, 
        functionName,
        functionProps,
        nasProps,
        baseDir,
        absCodeUri,
        funcArtifactDir,
        verbose, 
        imageTag,
        stages, 
        custom);

      const usedImage = opts.Image;
      if (!imageTag) {
        await docker.pullImageIfNeed(usedImage);
      }
    
      console.log('\nbuild function using image: ' + usedImage);
    
      // todo: 1. create container, copy source code to container
      // todo: 2. build and then copy artifact output 
    
      const errorTransform = processorTransformFactory({
        serviceName: serviceName,
        functionName: functionName,
        errorStream: process.stderr
      });
    
      //console.log(opts);
      const exitRs = await docker.run(opts, null, process.stdout, errorTransform);
      if (exitRs.StatusCode !== 0) {
        throw new Error(`build function ${serviceName}/${functionName} error`);
      }
    }

    async convertFunfileToDockerfile(funfilePath, dockerfilePath, runtime, serviceName, functionName) {
      const dockerfileContent = await parser.funfileToDockerfile(funfilePath, runtime, serviceName, functionName);

      await fs.writeFile(dockerfilePath, dockerfileContent);
    }

    async processFunfile(serviceName, serviceProps, codeUri, funfilePath, baseDir, funcArtifactDir, runtime, functionName) {
      //console.log(yellow('fcfile exist, will use container to build forcely'));

      const dockerfilePath = path.join(codeUri, '.Funfile.generated.dockerfile');
      await this.convertFunfileToDockerfile(funfilePath, dockerfilePath, runtime, serviceName, functionName);

      const nasConfig = (serviceProps || {}).Nas; //TODO confirm Nas path
      let nasMappings;
      if (nasConfig) {
        nasMappings = await nas.convertNasConfigToNasMappings(nas.getDefaultNasDir(baseDir), nasConfig, serviceName);
      }

      const tag = `fun-cache-${uuid.v4()}`;
      const imageTag = await docker.buildImage(codeUri, dockerfilePath, tag);

      // copy fun install generated artifact files to artifact dir
      console.log(`copying function artifact to ${funcArtifactDir}`);
      await docker.copyFromImage(imageTag, '/code/.', funcArtifactDir);
    
      // process nas folder
      await this.copyNasArtifact(nasMappings, imageTag, baseDir, funcArtifactDir);
      await fs.remove(dockerfilePath);
    
      return imageTag;
    }

    async copyNasArtifact(nasMappings, imageTag, rootArtifactsDir, funcArtifactDir) {
      // if .fun/nas exist in funcArtifactDir , fun will move co rootartifactsDir
      const funcNasFolder = path.join(funcArtifactDir, DEFAULT_NAS_PATH_SUFFIX);
      const rootNasFolder = path.join(rootArtifactsDir, DEFAULT_NAS_PATH_SUFFIX);
    
      if (await fs.pathExists(funcNasFolder) && funcNasFolder !== rootNasFolder) {
        console.log(`moving ${funcNasFolder} to ${rootNasFolder}`);
    
        await fs.ensureDir(rootNasFolder);
    
        await ncpAsync(funcNasFolder, rootNasFolder);
        await fs.remove(funcNasFolder);
      }
    
      if (nasMappings) {
        for (let nasMapping of nasMappings) {
          const localNasDir = nasMapping.localNasDir;
          let remoteNasDir = nasMapping.remoteNasDir;
    
          if (!remoteNasDir.endsWith('/')) {
            remoteNasDir += '/';
          }
    
          try {
            console.log('copy from container ' + remoteNasDir + '.' + ' to localNasDir');
            await docker.copyFromImage(imageTag, remoteNasDir + '.', localNasDir);
          } catch (e) {
            debug(`copy from image ${imageTag} directory ${remoteNasDir} to ${localNasDir} error`, e);
          }
        }
      }
    }

    async installPackageInDocker(packages, options = {}) {
      let pkgType = options.packageType;
      if (!pkgType) {
        if (options.runtime.includes('nodejs')) {
          pkgType = 'npm';
        } else if (options.runtime.includes('python')) {
          pkgType = 'pip';
        } else {
          console.log(red(`please specify 'packageType', can't know packageType for current runtime: ${options.runtime}`));
          throw new Error('Unknown packageType.');
        }
      }

      for (const pkg of packages) {
        const cmd = this.convertPackageToCmd(pkgType === 'apt' ? 'apt-get' : pkgType, pkg, options.url);
        options.cmd = cmd;

        await sboxForServerless(options);
      }
    
      if (options.save) {
        await this.save(options.runtime, options.absCodeUri, pkgType, packages, options.envs);
      }
    }

    async getFunctionRes(funcPath) {
      if (funcPath) {
        const tplPath = await detectTplPath(false);
        if (!tplPath || !path.basename(tplPath).startsWith('template')) {
          throw new Error(`Error: Can't find template file at ${process.cwd()}.`);
        }
    
        await validate(tplPath);
    
        const tpl = await getTpl(tplPath);
        const { functionRes } = findFunctionInTpl(funcPath, tpl);
        if (!functionRes) {
          throw new Error(`Error: function ${funcPath} not found in ${tplPath}`);
        }
        return functionRes;
      }
      return undefined;
    }
    
    async getCodeUri(functionRes) {
      if (functionRes) {
        if (functionRes.Properties && functionRes.Properties.CodeUri) {
          return path.resolve(functionRes.Properties.CodeUri);
        }
        throw new Error(`Error: can not find CodeUri in function`);
      }
      return process.cwd();
    }
    
    getRuntime(codeUri, functionRes, options) {
      let moduleRuntime;
    
      if (fs.existsSync(path.join(codeUri, 'fun.yml'))) {
        moduleRuntime = FunModule.load(path.join(codeUri, 'fun.yml')).runtime;
      }
    
      if (options.runtime) {
        if (moduleRuntime && options.runtime !== moduleRuntime) {
          throw new Error(red(`'${options.runtime}' specified by --runtime option doesn't match the one in fun.yml.`));
        }
        return options.runtime;
      } else if (options.function) {
        if (functionRes && functionRes.Properties && functionRes.Properties.Runtime) {
          if (moduleRuntime) {
            if (functionRes.Properties.Runtime !== moduleRuntime) {
              throw new Error(red(`'runtime' in template.yml and fun.yml is not equal`));
            }
          }
          return functionRes.Properties.Runtime;
        }
      } else if (moduleRuntime) {
        return moduleRuntime;
      }
      throw new Error(red('\'runtime\' is missing, you should specify it by --runtime option.'));
    }

    async save(runtime, codeUri, pkgType, packages, env) {
      let funfilePath = await getOrConvertFcfile(codeUri);
      let cmds = [];
    
      if (!funfilePath) {
        funfilePath = path.join(codeUri, 'fcfile');
        cmds.push(`RUNTIME ${runtime}`);
      }
    
      let resolvedEnv = resolveEnv(env).join(' ');
      if (!_.isEmpty(resolvedEnv)) {
        resolvedEnv = ' ' + resolvedEnv;
      }
    
      console.log(`\nsave package install commnad to ${funfilePath}`);
    
      for (const pkg of packages) {
        const cmd = await this.convertPackageToCmd(pkgType === 'apt' ? 'apt-get' : pkgType, pkg);
        cmds.push(`RUN${resolvedEnv} ${cmd}`);
      }
    
      console.log();
      await fs.appendFile(funfilePath, `\n${cmds.join('\n')}\n`);
    }

    validateRegistry(runtime, options) {
      if (options.indexUrl && options.registry) {
        throw new Error(`'--index-url' and '--registry' cannot be specified together.`);
      }
    
      if (options.indexUrl && !(runtime.indexOf('python') > -1)) {
        throw new Error(`'--index-url' needs to be used with '--runtime' python2.7/python3.6, and you are currently using ${runtime}`);
      }
    
      if (options.registry && !(runtime.indexOf('node') > -1)) {
        throw new Error(`'--registry' needs to be used with '--runtime' nodejs6/nodejs8/nodejs10/nodejs12, and you are currently using ${runtime}`);
      }
    }

    convertPackageToCmd(pkgType, pkg, url) {
    
      if (!_.includes(['pip', 'npm', 'apt-get'], pkgType)) {
        throw new Error(`unknow package type %${pkgType}`);
      }
    
      const defaultCmd = `fun-install ${pkgType} install ${pkg}`;
    
      if (pkgType == 'npm' && url) {
        return `${defaultCmd} --registry ${url}`;
      }

      if (pkgType == 'pip' && url) {
        return `${defaultCmd} --index-url ${url}`;
      }
    
      return defaultCmd;
    }

    // async installArtifact(serviceName, serviceProps, functionName, functionProps, codePath, artifactPath, verbose) {      
    //   const stages = ['install'];
    //   const runtime = functionProps.Runtime;

    //   const builder = new fcBuilders.Builder(serviceName, functionName, codePath, runtime, artifactPath, verbose, stages);
    //   await builder.build();
    // }

    // initBuildCodeDir(baseDir, serviceName, functionName) {
    //   const codePath = this.getCodeAbsPath(baseDir, serviceName, functionName);
    //   if (fs.pathExistsSync(codePath)) {
    //       fs.rmdirSync(codePath, { recursive: true });
    //   }
    //   fs.mkdirpSync(codePath);
    // }

    // initBuildArtifactDir(baseDir, serviceName, functionName) {
    //   const artifactPath = this.getArtifactPath(baseDir, serviceName, functionName);
    //   if (fs.pathExistsSync(artifactPath)) {
    //       fs.rmdirSync(artifactPath, { recursive: true });
    //   }
    //   fs.mkdirpSync(artifactPath);
    // }

    // async collectArtifact(runtime, funcArtifactDir) {
    //   if (!fs.pathExistsSync(funcArtifactDir)) {
    //     return;
    //   }

    //   if (runtime.includes("python")) {
    //     //copy dependency to the root dir for deploy/package later
    //     let source;
    //     const pythonLibDir = path.join(funcArtifactDir, ".fun", "python", "lib");
    //     if (!fs.pathExistsSync(pythonLibDir)) {
    //       return;
    //     }
    //     const libs = fs.readdirSync(pythonLibDir);
    //     if (libs.length == 1) {
    //       source = path.join(pythonLibDir, libs[0], "site-packages");
    //     } else {
    //       source = path.join(pythonLibDir, "python", "site-packages");
    //       libs.forEach(dir => {
    //         if (runtime === 'python3' && dir === 'python3.6') {
    //           source = path.join(pythonLibDir, "python3.6", "site-packages");
    //         } else if (runtime === 'python2.7' && dir === 'python2.7') {
    //           source = path.join(pythonLibDir, "python2.7", "site-packages");
    //         }
    //       })
    //     }

    //     await ncpAsync(source, funcArtifactDir);
    //   }

    //   //remove the unecessary directory 
    //   const funPath = path.join(funcArtifactDir, ".fun");
    //   if (fs.pathExistsSync(funPath)) {
    //     fs.rmdirSync(funPath, {recursive: true});
    //   }
      
    // }

    // isOnlyDefaultTaskFlow(taskFlows) {
    //   if (taskFlows.length !== 1) { return false; }
    
    //   return taskFlows[0].name === 'DefaultTaskFlow';
    // }

    // runtimeMustBuild(runtime) {
    //   if (!runtime || typeof runtime !== 'string') {
    //     return false;
    //   }

    //   return runtime.includes('java');
    // }

    // async codeNeedInstall(baseDir, codeUri, runtime) {
    //   //check codeUri
    //   if (!codeUri) {
    //     console.warn('No code uri configured, skip building.');
    //     return false;
    //   }
    //   if (typeof codeUri == 'string') {
    //     if (codeUri.endsWith('.zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war')) {
    //       console.log('Artifact configured, skip install.');
    //       return false;
    //     }
    //   } else {
    //     if (!codeUri.Src) {
    //       console.log('No Src configured, skip install.');
    //       return false;
    //     }
    //     if (codeUri.Src.endsWith('.zip') || codeUri.Src.endsWith('.jar') || codeUri.Src.endsWith('.war')) {
    //       console.log('Artifact configured, skip install.');
    //       return false;
    //     }
    //   }

    //   return true;
    // }

    // async copyCodeForBuild(baseDir, codeUri, serviceName, functionName) {
    //   const absCodeUri = path.resolve(baseDir, codeUri);
    //   const codePath = this.getCodeAbsPath(baseDir, serviceName, functionName);
    //   try {
    //     await ncpAsync(absCodeUri, codePath, {
    //       filter: (source) => {
    //         if (source.endsWith('.s') || source.endsWith('.fun') || source.endsWith('.git') 
    //             || source == 'vendor' || source == 'node_modules') {
    //           return false;
    //         }
    //         return true;
    //       }
    //     });
    //   } catch (e) {
    //     console.log(e)
    //   }
    // }

    // hasBuild(baseDir, serviceName, functionName) {
    //   const artifactPath = this.getArtifactPath(baseDir, serviceName, functionName);
    //   //TODO check if modified after last build
    //   return fs.pathExistsSync(artifactPath);
    // }

    // getArtifactPath(baseDir, serviceName, functionName) {
    //   const rootArtifact = path.join(baseDir, '.s', 'build', 'artifacts');
    //   return path.join(rootArtifact, serviceName, functionName);
    // }

    // getCodeAbsPath(baseDir, serviceName, functionName) {
    //   return path.join(baseDir, this.getCodeRelativePath(serviceName, functionName));
    // }
    // getCodeRelativePath(serviceName, functionName) {
    //   return path.join('.s', 'build', 'code', serviceName, functionName);
    // }
}


module.exports = Install;