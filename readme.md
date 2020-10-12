## 前言

通过本组件，您可以简单快速的将阿里云函数计算项目部署到线上。

## 使用

### 最简使用方法

模版拉取：

```
s init python3-http
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

系统默认bootstrap内容：

> 测试模板对应关系
> 不同语言的Event函数模板：`nodejs6`，`nodejs8`，`nodejs10`，`nodejs12`，`python27`，`python3`，`php72`
> 不同语言的Http函数模板：`nodejs6-http`，`nodejs8-http`，`nodejs10-http`，`nodejs12-http`，`python27-http`，`python3-http`，`php72-http`

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
      Log:
        LogStore: loghub中的logstore名称
        Project: loghub中的project名称
      Role: 授予函数计算所需权限的RAM role
      Vpc:
        SecurityGroupId: 安全组
        VSwitchIds:
          - 一个或多个VSwitch ID
        VpcId: VPC ID
      Nas:
        UseId: userID
        GroupId: groupID
        MountPoints:
          - ServerAddr: adasdasdas
            MountDir: ./ssssss
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
      Handler: function执行的入口，具体格式和语言相关
      MemorySize: function的内存规格
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
              Logstore: logstore1
            JobConfig:
              MaxRetryTime: 1
              TriggerInterval: 30
            LogConfig:
              Project: testlog
              Logstore: logstore2
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

### 详细使用方法

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Region | true | Enum | 地域 |
| Service | false | Struct | 服务 |
| Function | false | Struct | 函数 |

#### Region

参数取值：`cn-beijing`, `cn-hangzhou`, `cn-shanghai`, `cn-qingdao`, `cn-zhangjiakou`, `cn-huhehaote`, `cn-shenzhen`, `cn-chengdu`, `cn-hongkong`, `ap-southeast-1`, `ap-southeast-2`, `ap-southeast-3`, `ap-southeast-5`, `ap-northeast-1`, `eu-central-1`, `eu-west-1`, `us-west-1`, `us-east-1`, `ap-south-1`, `cn-zhangjiakou-na62-a01


#### Service

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Name | false | String | service名称 |
| Description | false | String | service的简短描述 |
| InternetAccess | false | Boolean | 设为true让function可以访问公网 |
| Role | false | String | 授予函数计算所需权限的RAM role, 使用场景包含 1. 把 function产生的 log 发送到用户的 logstore 中 2. 为function 在执行中访问其它云资源生成 token |
| Log | false | Struct | log配置，function产生的log会写入这里配置的logstore |
| Vpc | false | Struct | vpc配置, 配置后function可以访问指定VPC |
| Nas | false | Struct |  NAS配置, 配置后function可以访问指定NAS |
| Tag | false | <Struct>List | 标签 |

##### Log

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| LogStore | false | String | loghub中的logstore名称 |
| Project | false | String | loghub中的project名称 |

##### Vpc

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| SecurityGroupId | false | String | 安全组ID |
| VSwitchIds | false | String | 一个或多个VSwitch ID |
| VpcId | false | String | VPC ID |

##### Nas

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| UserId | false | String | userID |
| GroupId | false | String | groupID |
| MountPoints | false | <Struct>List | 挂载点 |


其中MountPoints为：

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| ServerAddr | false | String |  NAS 服务器地址 |
| MountDir | false | String | 本地挂载目录 |

##### Tag

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Key | false | String |  标签名 |
| Value | false | String | 标签值 |

#### Function

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Name | false | String |  function名称 |
| Description | false | String | function的简短描述 |
| MemorySize | false | String |  function的内存规格 |
| CodeUri | false(默认为./) | String/Struct | 代码位置 |
| Handler | true | String | function执行的入口，具体格式和语言相关 |
| Runtime | true | String | function的运行环境 |
| Initializer | false | Struct | 初始化方法 | 
| Environment | false | Struct | 环境变量 |
| Timeout | false | String | function运行的超时时间 |
| Triggers | false | <Struct>List |  触发器 |

##### Environment

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Key | false | String |  环境Key |
| Value | false | String | 环境Value |


##### CodeUri

- 
    直接填写路径
    
- 
    | 参数名 |  必填|  类型|  参数描述 | 
    | --- |  --- |  --- |  --- | 
    | Bucket | false | String | function code包的bucket name |
    | Object | false | String | code zip包的object name |
    | Exclude | false | <String>List | 除去路径 |
    | Include | false | <String>List | 包括路径 |

- 
    | 参数名 |  必填|  类型|  参数描述 | 
    | --- |  --- |  --- |  --- | 
    | Bucket | false | String | function code包的bucket name |
    | Src | false | String | 本地路径 |
    | Exclude | false | <String>List | 除去路径 |
    | Include | false | <String>List | 包括路径 |


##### Initializer

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Handler | false | String |  初始化 function 执行的入口，具体格式和语言相关 |
| Timeout | false | String | 初始化 function 运行的超时时间 |

##### Triggers


| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Name | true | String |  触发器名称 |
| Type | true | Enum |  触发器类型 |
| Parameters | true | Struct | 参数内容 |


###### Type

参数取值：`OSS`, `CDN`, `MNSTopici`, `TableStore`, `Timer`, `HTTP`, `RDS`, `LOG`


###### Parameters[HTTP]

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| AuthType | true | List |  鉴权类型，可选值：ANONYMOUS、FUNCTION |
| Methods | true | List | HTTP 触发器支持的访问方法 |
| Domains | false | String | 参数内容 |
| Enable | false | String | 表示是否启用该触发器。 |
| InvocationRole | false | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限 |
| Qualifier | false | String | service 版本 |

###### AuthType

枚举：`ANONYMOUS`，`FUNCTION`

###### Methods

枚举：`GET`，`POST`，`PUT`，`DELETE`，`HEAD`

###### Domains


- 
    | 参数名 |  必填|  类型|  参数描述 | 
    | --- |  --- |  --- |  --- | 
    | Domain | false | String | 域名 |
    
- 
    | 参数名 |  必填|  类型|  参数描述 | 
    | --- |  --- |  --- |  --- | 
    | Domain | false | String | 域名 |
    | Protocol | false | List(HTTP,HTTPS) | 协议 |
    | CertConfig | false | Struct | 域名证书 |
    | Routes | false | Struct | 路径配置 |


###### Parameters[OSS]

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Bucket | true | String | 存储桶名字 |
| Events | true | <String>List | 事件 |
| Filter | true | Struct | 条件 |
| Qualifier | false | String | Prod # 版本（可选) |

其中Filter：

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Prefix | true | String | 前缀 |
| Suffix | true | String | 后缀 |

###### Parameters[Timer]


| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| CronExpression | true | String | 触发事件表达式，例如'0 0 8 * * *' |
| Enable | false(默认是true) | Boolean | 是否开启 |
| Payload | false | Struct | 触发时传入的参数 |
| Qualifier | false | String | Prod # 版本（可选) |


###### Parameters[Log]
            
            
| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| SourceConfig | true | String | Source配置 |
| JobConfig | true | Struct | Job配置 |
| LogConfig | true | Struct | Log配置 |
| InvocationRole | false | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色 |
| FunctionParameter | false | String | 日志服务将该配置内容作为函数 event, 当事件触发时 |
| Enable | false(默认是true) | Boolean | 是否开启 |
| Qualifier | false | String | Prod # 版本（可选) |

其中SourceConfig：

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Logstore | true | String | 触发器会定时从该 Logstore 订阅数据到函数计算。 |


其中JobConfig：

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| MaxRetryTime | true | String | 表示日志服务触发函数执行时，如果遇到错误，所允许的最大尝试次数 |
| TriggerInterval | true | String | 表示日志服务触发函数执行的间隔 |

其中LogConfig：

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Project | true | String | 表示日志服务 Project 名称 |
| Logstore | true | String | 表示触发函数执行时，产生的日志会记录到该 Logstore |
| FunctionParameter | false | String | 当事件触发时，会连同它的内容一起发送给函数 |


###### Parameters[RDS]


| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| InstanceId | true | String | 表示日志服务 Project 名称 |
| SubscriptionObjects | false | String | 订阅对象，当前支持到表级别，只有这些表的更新才会触发函数执行 |
| Retry | false | String |  重试次数，可选值：[0,3], 默认值为3。 |
| Concurrency | false | String | 调用并发量，可选值：[1，5], 默认值为1 |
| EventFormat | false | String | event格式，可选值：json, protobuf, 默认值为 protobuf。 |
| InvocationRole | false | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限。 |
| Qualifier | false | String | Prod # 版本（可选) |

###### Parameters[MNSTopic]

            
| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| TopicName | true | String | mns topic的名字 |
| Region | false | String |  mns topic 所在的 region，如果不填，默认为和函数一样的 region |
| NotifyContentFormat | false | String |  推送给函数入参 event 的格式，可选值：STREAM, JSON, 默认值为: STREAM。 |
| NotifyStrategy | false | String | 调用函数的重试策略，可选值：BACKOFF_RETRY, EXPONENTIAL_DECAY_RETRY, 默认值为: BACKOFF_RETRY |
| FilterTag | false | String | 描述了该订阅中消息过滤的标签（标签一致的消息才会被推送）,不超过 16 个字符的字符串，默认不进行消息过滤，即默认不填写该字段。 |
| InvocationRole | false | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限。 |
| Qualifier | false | String | Prod # 版本（可选) |

###### Parameters[TableStore]

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| InstanceName | true | String | 表格存储实例的名字 |
| TableName | true | String | 实例中的表名 |
| InvocationRole | false | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限。 |
| Qualifier | false | String | Prod # 版本（可选) |

###### Parameters[CDN]

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| EventName | true | String |  为 CDN 端触发函数执行的事件，一经创建不能更改 |
| EventVersion | true | String |  为 CDN 端触发函数执行事件的版本，一经创建不能更改 |
| Notes | true | String | 备注信息 |
| Filter | true | Struct | 过滤器（至少需要一个过滤器） |
| InvocationRole | false | String | 使用一个 RAM 角色的 ARN 为函数指定执行角色，事件源会使用该角色触发函数执行，请确保该角色有调用函数的权限。 |
| Qualifier | false | String | Prod # 版本（可选) |


其中Filter：

| 参数名 |  必填|  类型|  参数描述 | 
| --- |  --- |  --- |  --- | 
| Domain | true | <String>List |  是个字符串数组且必填，代表过滤参数值的集合。 |