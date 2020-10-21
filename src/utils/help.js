module.exports = (inputs) => ({
  install: {
    description: `Usage: s install [command] [packageNames...] [-r|--runtime <runtime>] [-p|--package-type <type>] [--save] [-e|--env key=val ...]

      install dependencies for your project.`,
    commands: [{
      name: 'docker',
      desc: 'use docker to install dependencies.'
    }, {
      name: 'local',
      desc: 'install dependencies.'
    }],
    args: [{
      name: '-e/--env <env>',
      desc: 'environment variable, ex. -e PATH=/code/bin (default: [])'
    }, {
      name: '-r/--runtime <runtime>',
      desc: 'function runtime, avaliable choice is: nodejs6, nodejs8, nodejs10, nodejs12, python2.7, python3, java8, php7.2, dotnetcore2.1, custom, custom-container.'
    }, {
      name: '-p/--package-type <type>',
      desc: 'avaliable package type option: pip, apt, npm.'
    }, {
      name: '--url',
      desc: 'for nodejs this can be configured as custom registry, for python this should be Base URL of Python Package Index (default https://pypi.org/simple).'
    }, {
      name: '--save',
      desc: 'save install command to fcfile.'
    }, {
      name: '-f/--file <fcfile>',
      desc: 'use fcfile before installing, this path should be relative to your codeUri.'
    }, {
      name: '-c/--cmd <cmd>',
      desc: 'command with arguments to execute inside the installation docker.'
    }
    ]
  },
  build: {
    description: `Usage: s build [command]

    Build the dependencies.`,
    commands: [{
      name: 'docker',
      desc: 'use docker to build dependencies.'
    }, {
      name: 'local',
      desc: 'build dependencies directly.'
    }, {
      name: 'image',
      desc: 'build image for custom-runtime project.'
    }]
  },
  deploy: {
    description: `Usage: s ${inputs.Project.ProjectName} deploy [command]
  
    Deploy a serverless application`,
    commands: [{
      name: 'service',
      desc: 'only deploy service.'
    }, {
      name: 'function',
      desc: 'only deploy function.'
    }, {
      name: 'function --config',
      desc: 'only deploy function config.'
    }, {
      name: 'function --code',
      desc: 'only deploy function code.'
    }, {
      name: 'tags',
      desc: 'only deploy service tags.'
    }, {
      name: 'tags -k/--key <name>',
      desc: 'only the specified service tag are deploy.'
    }, {
      name: 'domain',
      desc: 'only deploy domain.'
    }, {
      name: 'domain -d/--domain <name>',
      desc: 'only deploy the specified domain name.'
    }, {
      name: 'trigger',
      desc: 'only deploy trigger.'
    }, {
      name: 'trigger -n/--name <name>',
      desc: 'only deploy the specified trigger name.'
    }],
    args: [{
      name: '--config',
      desc: 'only deploy config.'
    }]
  },
  remove: {
    description: `Usage: s ${inputs.Project.ProjectName} remove [command]
  
    Delete application.`,
    commands: [{
      name: 'function',
      desc: 'only remove function.'
    }, {
      name: 'tags',
      desc: 'only remove service tags.'
    }, {
      name: 'tags -k, --key <name>',
      desc: 'only the specified service tag are remove.'
    }, {
      name: 'domain',
      desc: 'only remove domain.'
    }, {
      name: 'domain -d, --domain <name>',
      desc: 'only remove the specified domain name.'
    }, {
      name: 'trigger',
      desc: 'only remove trigger.'
    }, {
      name: 'trigger -n, --name <name>',
      desc: 'only remove the specified trigger name.'
    }],
    args: [{
      name: '-f/--force',
      desc: 'delete auto generated resource by force.'
    }]
  },
  metrics: {
    description: `Usage: s ${inputs.Project.ProjectName} metrics
  
    Monitoring function indicators.`
  },
  publish: {
    description: `Usage: s ${inputs.Project.ProjectName} publish
  
    Publish service version/alias.`,
    commands: [{
      name: 'version -d [description]',
      desc: 'publish version'
    }, {
      name: 'alias -d [description] -v <versionId> -gv [grayVersionId] -w [grayVersionWeight]',
      desc: 'publish alias.'
    }]
  },
  unpublish: {
    description: `Usage: s ${inputs.Project.ProjectName} unpublish
  
    Unpublish service version/alias.`,
    commands: [{
      name: 'version -v/--versionId [versionId]',
      desc: 'unpublish the specified versionId.'
    }, {
      name: 'version -n/--name [name]',
      desc: 'unpublish the specified alias name.'
    }]
  },
  sync: {
    description: `Usage: s ${inputs.Project.ProjectName} sync
  
    Synchronize remote configuration.`,
    commands: [{
      name: 'service',
      desc: 'only sync service.'
    }, {
      name: 'tags',
      desc: 'only sync service tags.'
    }, {
      name: 'function',
      desc: 'only sync function config.'
    }, {
      name: 'code',
      desc: 'only sync function code.'
    }, {
      name: 'trigger',
      desc: 'only sync trigger.'
    }]
  },
  invoke: {
    description: `Usage: s ${inputs.Project.ProjectName} invoke [command]

    Execute your function in a [local/docker/fc] environment.`,
    commands: [
      {
        name: 'local',
        desc: 'execute your function in a local environment'
      },
      {
        name: 'docker',
        desc: 'execute your function in a docker environment'
      },
      {
        name: 'remote',
        desc: 'execute your function in a fc environment'
      }
    ],

    args: [
      {
        name: '-c/--config <ide/debugger>',
        desc: 'Select which IDE to use when debugging and output related debug config tips for the IDE. Options：\'vscode\', \'pycharm\''
      },
      {
        name: '-d/--debug-port <port>',
        desc: 'Specify the sandbox container starting in debug' +
        ' mode, and exposing this port on localhost'
      },
      {
        name: '-e/--event <event>',
        desc: 'Support Event data(strings) or a file containing event data passed to the function during invocation.'
      },
      {
        name: '-f/--event-file <path>',
        desc: 'A file containing event data passed to the function during invoke.'
      },
      {
        name: '-s/--event-stdin',
        desc: 'Read from standard input, to support script pipeline.\n'
      },

      {
        name: '--no-reuse',
        desc: 'Do not reuse the container when using \'s invoke docker\' [options].'
      },
      {
        name: '--tmp-dir <tmpDir>',
        desc: 'The temp directory mounted to /tmp'
      },
      {
        name: '--debug-args <debugArgs>',
        desc: 'additional parameters that will be passed to the debugger'
      },
      {
        name: '--debugger-path <debuggerPath>',
        desc: 'the path of the debugger on the host'
      }
    ]
  },
  logs: {

    description: `Usage: s ${inputs.Project.ProjectName} logs [options]

    Search logs from SLS`,

    args: [
      {
        name: '-s/--start-time',
        desc: 'query start time, like 2020-10-4 12:00:00'
      },
      {
        name: '-e/--end-time',
        desc: 'query end time, like 2020-10-4 13:00:00'
      },
      {
        name: '-k/--keyword',
        desc: 'keyword search.'
      },
      {
        name: '-r/--requestId',
        desc: 'requestId search.'
      },
      {
        name: '-t/--tail',
        desc: 'display log in real time'
      }
    ]
  },
  nas: {
    description: `Usage: s nas [command] [options] [arguments]

    Operate NAS file system. Example:
    * s nas sync : sync directories and files to NAS configured in template.yaml.
    * s nas sync -n : sync directories and files to NAS without overwriting existed files.
    * s nas ls /mnt/auto : list files under /mnt/auto.`,
    commands: [{
      name: 'sync',
      desc: 'synchronize the local directory to the remote NAS file system.'
    }, {
      name: 'ls <FcDir>',
      desc: 'list files under FcDir.'
    }],
    args: [{
      name: '-n/--no-overwrite',
      desc: 'Never overwrite existing files on NAS when synchronizing files.'
    }, {
      name: '-a/--alias <alias>',
      desc: 'Synchronize to NAS with this alias.'
    }, {
      name: '--all',
      desc: 'Come with \'ls\' command for showing all files.'
    }]
  }
})
