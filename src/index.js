const { Component } = require('@serverless-devs/s-core')
const { Service, Function, Trigger, CustomDomain, Alias, Version, InvokeRemote } = require('./utils/fc')
const TAG = require('./utils/tag')
const {fstat, existsSync} = require('fs-extra')
const { execSync } = require('child_process');

const DEFAULT = {
  Region: 'cn-hangzhou',
  Service: 'Default'
}

class FcComponent extends Component {
  // 解析入参
  handlerInputs(inputs) {

    const credentials = inputs.Credentials
    const properties = inputs.Properties
    const state = inputs.State || {}
    const args = inputs.Args

    const type = args.type;

    const serviceInput = properties.Service || {}
    const serviceState = state.Service || {}
    const serviceName = serviceInput.Name
      ? serviceInput.Name
      : serviceState.Name
      ? serviceState.Name
      : DEFAULT.Service
    const functionName = properties.Function ? properties.Function.Name : ''
    const region = properties.Region || DEFAULT.Region;

    return {
      credentials,
      properties,
      type,
      args,
      functionName,
      serviceName,
      region
    }
  }

  // 部署
  async deploy(inputs) {
    // 全局部署
    const projectName = inputs.Project.ProjectName
    const credentials = inputs.Credentials
    const properties = inputs.Properties
    const state = inputs.State || {}
    const { Commands: commands, Parameters: parameters } = this.args(inputs.Args);

    const deployType = commands[0];
    let isDeployAll = false;
    if (commands.length === 0) {
      isDeployAll = true;
    }

    const serviceInput = properties.Service || {}
    const serviceState = state.Service || {}
    const serviceName = serviceInput.Name
      ? serviceInput.Name
      : serviceState.Name
      ? serviceState.Name
      : DEFAULT.Service
    const functionName = properties.Function.Name

    const output = {}
    const region = properties.Region || DEFAULT.Region;

    // 单独部署服务
    if (deployType === 'service' || isDeployAll) {
      const fcService = new Service(credentials, region)
      output.Service = await fcService.deploy(properties, state)
    }

    // 单独部署函数
    if (deployType === 'function' || isDeployAll) {
      if (properties.Function) {
        const fcFunction = new Function(credentials, region)
        output.Function = await fcFunction.deploy(properties, state, projectName, serviceName, commands)
      }
    }

    // 单独部署触发器
    if (deployType === 'trigger' || isDeployAll) {
      if (properties.Function && properties.Function.Triggers) {
        const fcTrigger = new Trigger(credentials, region)
        output.Triggers = await fcTrigger.deploy(properties, serviceName, functionName, commands, parameters)
      }
    }

    // 单独部署标签
    if (deployType == 'tags' || deployType == 'all') {
      if (properties.Service && properties.Service.Tags) {
        const tag = new TAG(credentials, region)
        const serviceArn = 'services/' + serviceName
        output.Tags = await tag.deploy(serviceArn, properties.Service.Tags)
      }
    }

    // 单独部署自定义域名
    if (deployType == 'domain') {
      if (properties.Function && properties.Function.Domains) {
        output.Domains = await this.domain(inputs)
      }
    }

    // 存储服务状态

    // 返回结果
    return output
  }

  // 部署自定义域名
  async domain(inputs) {
    const {
      credentials,
      properties,
      functionName,
      serviceName,
      region
    } = this.handlerInputs(inputs);
    const fcDomain = new CustomDomain(credentials, region)
    
    return await fcDomain.deploy(
      properties.Function.Domains,
      serviceName,
      functionName
    )
  }

  // 版本
  async version(inputs) {
    const { credentials, region, serviceName, type, args } = this.handlerInputs(inputs);
    const fcVersion = new Version(credentials, region);

    if (type === 'publish') {
      await fcVersion.publish(serviceName, args.description);
    } else if (type === 'delete') {
      await fcVersion.delete(serviceName, args.versionId);
    }
  }

  // 删除版本
  async alias(inputs) {
    const { credentials, region, serviceName, type, args } = this.handlerInputs(inputs);

    const fcAlias = new Alias(credentials, region);

    if (type === 'publish') {
      const config = {
        Name: args.name,
        Version: args.Version,
        Description: args.Description,
        additionalVersionWeight: args.additionalVersionWeight
      }
      const alias = await fcAlias.findAlias(serviceName, args.name);
      if (alias) {
        await fcAlias.update(config, serviceName);
      } else {
        await fcAlias.publish(config, serviceName);
      }
    } else if (type === 'delete') {
      await fcAlias.delete(serviceName, args.aliasName);
    }
  }

  // 移除
  async remove(inputs) {
    const projectName = inputs.Project.ProjectName
    const credentials = inputs.Credentials
    const properties = inputs.Properties
    const state = inputs.State || {}
    const args = inputs.Args

    const removeType = args.type ? args.type : 'all'

    const serviceInput = properties.Service || {}
    const serviceState = state.Service || {}
    const region = properties.Region || DEFAULT.Region;
    const serviceName = serviceInput.Name
      ? serviceInput.Name
      : serviceState.Name
      ? serviceState.Name
      : DEFAULT.Service
    const functionName = properties.Function.Name

    // 解绑标签
    if (removeType == 'tags') {
      // TODO 指定删除标签
      const tag = new TAG(credentials, region)
      const serviceArn = 'services/' + serviceName
      await tag.remove(serviceArn)
    }

    // 单独删除触发器
    if (removeType == 'trigger' || removeType == 'all') {
      // TODO 指定删除特定触发器
      const fcTrigger = new Trigger(credentials, region)
      await fcTrigger.remove(serviceName, functionName)
    }

    // 单独删除函数
    if (removeType == 'function' || removeType == 'all') {
      const fcFunction = new Function(credentials, region)
      await fcFunction.remove(serviceName, functionName)
    }

    // 单独删除服务
    // TODO 服务是全局的，当前组件如何判断是否要删除服务？
    if (removeType == 'service' || removeType == 'all') {
      const fcService = new Service(credentials, region)
      await fcService.remove(serviceName)
    }
  }

  // 触发
  async invoke(inputs) {
    const {
      credentials,
      type = '',
      args,
      functionName,
      serviceName,
      region
    } = this.handlerInputs(inputs);
    
    const invokeType = type.toLocaleUpperCase();
    if (invokeType !== 'EVENT' && invokeType !== 'HTTP') {
      throw new Error('Need to specify the function execution type: event or http');
    }

    const invokeRemote = new InvokeRemote(credentials, region);
    if (invokeType === 'EVENT') {
      await invokeRemote.invokeEvent(serviceName, functionName, { eventFilePath: args.eventFilePath, event: args.event }, args.qualifier);
    } else {
      await invokeRemote.invokeHttp(serviceName, functionName, { eventFilePath: args.eventFilePath }, args.qualifier);
    }
  }

  // 日志
  async logs(inputs) {
    // const args = inputs.Args
    // if(args.includes("-t") || args.includes('--tail')){
    //
    // }
  }

  // 指标
  async metrics(inputs) {}

  // 安装
  async install(inputs) {}

  // 构建
  async build(inputs) {
    const properties = inputs.Properties;
    const functionProperties = properties.Function;
    const customContainer = functionProperties.CustomContainer;

    const dockerBuild = functionProperties.Runtime == "custom-container";
    if (dockerBuild) {
      if (!customContainer) {
        throw new Error("No CustomContainer found for container build");
      }
      let dockerFile = "Dockerfile";
      if (customContainer && customContainer.Dockerfile) {
        dockerFile = customContainer.Dockerfile;
      }
      if (!customContainer.Image) {
        throw new Error("No CustomContainer.Image found for container build");
      }
      const imageName = customContainer.Image;
      
      if (!existsSync(dockerFile)) {
        throw new Error("No dockerfile found.");
      }
  
      try {
        console.log("Building image...");
        execSync(`docker build -t ${imageName} -f ${dockerFile} .`, {
          stdio: 'inherit'
        })
        console.log(`Build image(${imageName}) successfully`);
      } catch (e) {
        console.log(e.message);
        throw e;
      }
    }
    
  }

  // 发布
  async publish(inputs) {}

  // 打包
  async package(inputs) {}

  // NAS操作
  async nas(inputs) {}
}

module.exports = FcComponent
