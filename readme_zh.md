## 前言

通过本组件，您可以简单快速的将阿里云函数计算项目部署到线上。

## 使用

### 最简使用方法

模版拉取：

```
s init python3-http -p alibaba
```

其中Yaml的默认配置为：

```yaml
MyFunctionDemo:
  Component: fc
  Provider: alibaba
  Properties:
    Region: cn-hangzhou
    Service:
      Name: ServerlessToolProject
      Description: 欢迎使用ServerlessTool
    Function:
      Name: serverless_demo_python3_http
      Description: 这是一个Python3-HTTP的测试案例
      CodeUri: ./
      Handler: index.handler
      MemorySize: 128
      Runtime: python3
      Timeout: 5
      Triggers:
        - Name: TriggerNameHttp
          Type: HTTP
          Parameters:
            AuthType: ANONYMOUS
            Methods:
              - GET
              - POST
              - PUT
            Domains:
              - Domain: AUTO
```

### 完整Yaml示例

```yaml
MyFunction:
  Component: fc
  Provider: alibaba
  Access: release
  Properties:
    Region: cn-huhehaote
    Service:
      Name: 服务名
      Description: 服务描述
      InternetAccess: 访问公网
#      Log: Auto
      Log:
        LogStore: loghub中的logstore名称
        Project: loghub中的project名称
#      Role: <角色名称> 或 <角色ARN>
      Role: # 授予函数计算所需权限的RAM role
          Name: <角色名称>
          Policies:
            - AliyunECSNetworkInterfaceManagementAccess
            - AliyunFCFullAccess
#      Vpc: Auto
      Vpc:
        SecurityGroupId: 安全组
        VSwitchIds:
          - 一个或多个VSwitch ID
        VpcId: VPC ID
#      Nas: Auto
#      Nas:
#        Type: Auto
#        UserId: 33
#        GroupId: 33
#        FcDir: /home/aaaaaa
#        LocalDir: ./ssss
#        LocalDir: 
#          - ./ssss
      Nas:
        UserId: userID
        GroupId: groupID # s nas sync
        MountPoints:
          - Alias: demo # 选填
            NasAddr: 3e3544a894-qjf60.cn-shanghai.nas.aliyuncs.com
            NasDir: /demo
            FcDir: /home/ssss
            LocalDir: ./ssss
          - NasAddr: 3e3544a894-qjf60.cn-shanghai.nas.aliyuncs.com
            NasDir: /demo
            FcDir: /home/aaaaaa
            LocalDir: 
              - path
      Tags:
        - Key: 标签名
          Value: 标签值
        - Key: 标签名
          Value: 标签值
    Function: 函数名
      Name: 函数名
      Description: 函数描述
      #      CodeUri: 本地路径
      #      CodeUri:
      #        Bucket: function code包的bucket name
      #        Object: code zip包的object name
      CodeUri:
        Bucket: function code包的bucket name
        Src: 本地路径
        Excludes:
          - path1
          - path2
        Includes:
          - path1
          - path2
      CAPort: 8080 #指定端口
      CustomContainer:
        Dockerfile: ./dockerfile
        CrAccount:
          User: xx  #如指定则会自动进行登录
          Password: xx #如指定则会自动进行登录
        Image: 'registry.cn-hangzhou.aliyuncs.com/lvwantest/nahai-repo:latest'  # 仓库地址
        Command: '[ "node"]'
        Args: '["server.js"]'
      Handler: function执行的入口，具体格式和语言相关
      MemorySize: function的内存规格
      InstanceConcurrency: 单实例多并发
      Runtime: function的运行环境
      Environment:
        - Key: Environmentkey
          Value: EnvironmentValue
      Timeout: function运行的超时时间
      Initializer:
        Handler: 初始化 function 执行的入口，具体格式和语言相关
        Timeout: 初始化 function 运行的超时时间
      Triggers:
        - Name: OSSTrigger
          Type: OSS # trigger type
          Parameters:
            Bucket: coco-superme # oss bucket name
            Events:
              - oss:ObjectCreated:*
              - oss:ObjectRemoved:DeleteObject
            Filter:
              Prefix: source/
              Suffix: .png
            Qualifier: Prod # 版本（可选)
        - Name: TriggerNameTimer
          Type: Timer
          Parameters:
            CronExpression: '0 0 8 * * *'
            Enable: true
            Payload: 'awesome-fc-event-nodejs10'
            Qualifier: Prod # 版本（可选)
        - Name: TriggerNameHttp
          Type: HTTP # trigger type
          Parameters:
            AuthType: ANONYMOUS
            InvocationRole: 使用一个 RAM 角色的 ARN 为函数指定执行角色
            Methods:
              - GET
              - POST
              - PUT
            Domains:
              - Domain: anycodes.cn
                Protocol:
                  - HTTP
                  - HTTPS
                CertConfig:
                  CertName: 'CertName'
                  PrivateKey: './certificates/privateKey.pem'
                  Certificate: './certificates/certificate.pem'
                Routes:
                  - Path: '/a'
                    Qualifier: Prod # 版本（可选)
                  - Path: '/a'
                    Qualifier: Prod # 版本（可选)
        - Name: TriggerNameLog
          Type: Log
          Parameters:
            SourceConfig:
              LogStore: logstore1
            JobConfig:
              MaxRetryTime: 1
              TriggerInterval: 30
            LogConfig:
              Project: testlog
              LogStore: logstore2
            Enable: true
            FunctionParameter: 日志服务将该配置内容作为函数 event, 当事件触发时
            InvocationRole: 使用一个 RAM 角色的 ARN 为函数指定执行角色
            Qualifier: Prod # 版本（可选)
        - Name: TriggerNameRDS
          Type: RDS # trigger type
          Parameters:
            InstanceId: rm-12345799xyz
            SubscriptionObjects:
              - db1.table1
            Retry: 2
            Concurrency: 1
            EventFormat: json
            InvocationRole: 使用一个 RAM 角色的 ARN 为函数指定执行角色
            Qualifier: Prod # 版本（可选)
        - Name: TriggerNameMNS
          Type: MNSTopic # trigger type
          Parameters:
            TopicName: test-topic
            Region: cn-shanghai
            NotifyContentFormat: JSON
            NotifyStrategy: BACKOFF_RETRY
            FilterTag: 描述了该订阅中消息过滤的标签
            InvocationRole: 使用一个 RAM 角色的 ARN 为函数指定执行角色
            Qualifier: Prod # 版本（可选)
        - Name: TriggerNameTableStore
          Type: TableStore # trigger type
          Parameters:
            InstanceName: test-inst
            TableName: test-tbl
            InvocationRole: 使用一个 RAM 角色的 ARN 为函数指定执行角色
            Qualifier: Prod # 版本（可选)
        - Name: TriggerNameCDN
          Type: CDN # trigger type
          Parameters:
            EventName: LogFileCreated
            EventVersion: '1.0.0'
            Notes: cdn events trigger test
            Filter:
              Domain:
                - 'www.taobao.com'
                - 'www.tmall.com'
            InvocationRole: 使用一个 RAM 角色的 ARN 为函数指定执行角色
            Qualifier: Prod # 版本（可选)
```

# 参数详情

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Region | True | Enum | 地域 |
| Service | True | Struct | 服务 |
| Function | True | Struct | 函数 |

## Service
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | service名称 |
| Description | True | String | Service的简短描述 |
| InternetAccess | False | Boolean | 设为true让function可以访问公网 |
| Log | False | Enum[简单配置]/Struct[详细配置] | log配置，function产生的log会写入这里配置的logstore |
| Role | False | String[简单配置]/Struct[详细配置] | 授予函数计算所需权限的RAM role, 使用场景包含 1. 把 function产生的 log 发送到用户的 logstore 中 2. 为function 在执行中访问其它云资源生成 token |
| Vpc | False | Enum[简单配置]/Struct[详细配置] | VPC配置, 配置后function可以访问指定VPC |
| Nas | False | Enum[简单配置]/Struct[半自动配置]/Struct[详细配置] | NAS配置, 配置后function可以访问指定NAS |
| Tag | False | List<Struct> | 标签配置 |

### Log
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| LogStore | False | String | loghub中的logstore名称 |
| Project | False | String | loghub中的project名称 |

### Role
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | 角色名 |
| Policies | True | List<String> | 策略列表 |

### Vpc
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| SecurityGroupId | False | String | 安全组ID |
| VSwitchIds | False | List<String> | 一个或多个VSwitch ID |
| VpcId | False | String | VPC ID |

### Nas
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Type | True | Enum | 自动化配置 |
| FcDir | False | String | 函数计算目录 |
| LocalDir | False | String[单一目录]/List<String>[多目录配置] | 本地目录 |
| UserId | False | String | userID |
| GroupId | False | String | groupID |

#### MountPoints
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Alias | False | String | 针对组件生效的别名 |
| NasAddr | False | String | NAS 服务器地址 |
| NasDir | False | String | NAS目录 |
| FcDir | False | String | 函数计算目录 |
| LocalDir | False | String[单一目录]/List<String>[多目录配置] | 本地目录 |

### Nas
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| UserId | False | String | userID |
| GroupId | False | String | groupID |
| MountPoints | False | List<Struct> | 挂载点 |

#### MountPoints
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Alias | False | String | 针对组件生效的别名 |
| NasAddr | False | String | NAS 服务器地址 |
| NasDir | False | String | NAS目录 |
| FcDir | False | String | 函数计算目录 |
| LocalDir | False | String[单一目录]/List<String>[多目录配置] | 本地目录 |

### Tag
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Key | True | String | 标签名 |
| Value | True | String | 标签值 |

## Function
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | function名称 |
| Description | False | String | function的简短描述 |
| CodeUri | False | String[简单配置]/Struct[OSS部署]/Struct[复杂配置] | 代码位置 |
| CAPort | False | Number | CustomContainer/Runtime指定端口 |
| CustomContainer | False | Struct | 自定义镜像配置 |
| Handler | False | String | function执行的入口，具体格式和语言相关 |
| MemorySize | False | Number | function的内存规格 |
| Runtime | False | String | 运行时 |
| Timeout | False | Number | function运行的超时时间 |
| InstanceConcurrency | False | Number | 单实例多并发 |
| Environment | False | List<Struct> | 环境变量 |
| Initializer | False | Struct | 初始化方法 |
| Triggers | False | List<Struct> | 触发器 |

### CodeUri
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Bucket | False | String | function code包的bucket name |
| Object | False | String | code zip包的object name |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Bucket | False | String | function code包的bucket name |
| Src | False | String | 本地路径 |
| Exclude | False | List<String> | 额外除去的本地路径 |
| Include | False | List<String> | 额外包括的本地路径 |

### CustomContainer
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CrAccount | False | Struct | 账号信息 |
| Image | False | String | 仓库地址 |
| Command | False | String | 指令 |
| Args | False | String | 参数 |

#### CrAccount
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| User | False | String | CrAccount账号 |
| Password | False | String | CrAccount密码 |

### Environment
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Key | False | String | 环境变量Key |
| Value | False | String | 环境变量Value |

### Initializer
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Handler | False | String | 初始化 function 执行的入口，具体格式和语言相关 |
| Timeout | False | String | 初始化 function 运行的超时时间 |

### Triggers
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | 触发器名称 |
| Type | True | Enum | 触发器类型 |
| Parameters | True | Struct[OSS触发器]/Struct[时间触发器]/Struct[CDN触发器]/Struct[表格存储触发器]/Struct[MNS触发器]/Struct[RDS触发器]/Struct[LOG日志触发器]/Struct[HTTP触发器] | 参数类型 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Bucket | True | String | 为 OSS 中对应的 bucket 名称 |
| Events | True | List | 为 OSS 端触发函数执行的事件 |
| Filter | True | Struct | 筛选条件 |
| InvocationRole | False | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CronExpression | False | String | 时间触发器表达式 |
| Enable | False | Boolean | 表示是否启用该触发器 |
| Payload | False | String | 传入参数 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| EventName | True | String | 为 CDN 端触发函数执行的事件，一经创建不能更改 |
| EventVersion | True | String | 为 CDN 端触发函数执行事件的版本，一经创建不能更改 |
| Notes | True | String | 备注信息 |
| Filter | True | Struct | 过滤器（至少需要一个过滤器） |
| InvocationRole | False | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| InstanceName | True | String | 表格存储实例的名字 |
| TableName | True | String | 实例中的表名 |
| InvocationRole | False | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| TopicName | True | String | mns topic的名字 |
| Region | False | String | mns topic 所在的 region，如果不填，默认为和函数一样的 region |
| NotifyContentFormat | False | Enum | 推送给函数入参 event 的格式，可选值：STREAM, JSON |
| NotifyStrategy | False | Enum | 调用函数的重试策略，可选值：BACKOFF_RETRY, EXPONENTIAL_DECAY_RETRY |
| FilterTag | False | String | 描述了该订阅中消息过滤的标签（标签一致的消息才会被推送）,不超过 16 个字符的字符串，默认不进行消息过滤，即默认不填写该字段 |
| InvocationRole | False | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| InstanceId | True | String | RDS 实例 ID |
| SubscriptionObjects | False | List<String> | 订阅对象，当前支持到表级别，只有这些表的更新才会触发函数执行 |
| Retry | False | Number | 重试次数，可选值：[0,3], 默认值为3 |
| Concurrency | False | Enum | 调用并发量，可选值：[1，5], 默认值为1 |
| EventFormat | False | Enum | event格式，可选值：json, protobuf |
| InvocationRole | False | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Logstore | True | String | 数据源的 Logstore 名称。触发器会定时从该 Logstore 订阅数据到函数计算 |
| JobConfig | False | Struct | 包含两个可配置属性 |
| LogConfig | False | Struct | 包含三个可配置属性 |
| FunctionParameter | False | Struct | 日志服务将该配置内容作为函数 event, 当事件触发时，会连同它的内容一起发送给函数 |
| Enable | False | Boolean | 表示是否启用该触发器 |
| InvocationRole | False | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

#### Parameters
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| AuthType | True | Enum | 鉴权类型，可选值：ANONYMOUS、FUNCTION |
| Methods | True | List<Enum> | HTTP 触发器支持的访问方法 |
| Domains | False | List<Struct>[自动配置]/List<Struct>[自定义配置] | 自定义域名配置 |
| FunctionParameter | False | Struct | 日志服务将该配置内容作为函数 event, 当事件触发时，会连同它的内容一起发送给函数 |
| Enable | False | Boolean | 表示是否启用该触发器 |
| InvocationRole | False | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | False | String | service 版本 |

##### Filter
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | 前缀 |
| Suffix | False | String | 后缀 |

| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | 网址 |

##### JobConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | False | String | 表示日志服务触发函数执行的间隔 |

##### LogConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | 表示日志服务 Project 名称 |
| LogStore | False | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |

##### Domains
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | 域名 |
| Protocol | True | List<Enum> | 协议 |
| CertConfig | False | Struct | 域名证书 |
| Routes | False | List<Struct> | 路径配置 |

###### CertConfig
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | 名称 |
| PrivateKey | False | String | 表示私钥 |
| Certificate | False | String | 表示证书 |

###### Routes
| 参数名 |  必填  |  类型  |  参数描述  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | 路径 |
| Qualifier | False | String | service 版本 |
