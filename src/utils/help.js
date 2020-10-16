module.exports = (inputs) => ({
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
      name: 'tags -k, --key <name>',
      desc: 'only the specified service tag are deploy.'
    }, {
      name: 'domain',
      desc: 'only deploy domain.'
    }, {
      name: 'domain -d, --domain <name>',
      desc: 'only deploy the specified domain name.'
    }, {
      name: 'trigger',
      desc: 'only deploy trigger.'
    }, {
      name: 'trigger -n, --name <name>',
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
    }]
  },
  metrics: {
    description: `Usage: s ${inputs.Project.ProjectName} metrics
  
    Monitoring function indicators.`,
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
      name: 'version -v, --versionId [versionId]',
      desc: 'unpublish the specified versionId.' 
    }, {
      name: 'version -n, --name [name]',
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
  }
})