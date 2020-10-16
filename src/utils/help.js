module.exports = (inputs) => ({
  deploy: {
    description: `Usage: s ${inputs.Project.ProjectName} deploy [command]
  
    Deploy the dependencies.`,
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
  
    Remove the dependencies.`,
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
  }
})