## Preface



Through this component, you can easily and quickly deploy alicloud function computing projects to the online.



## Use



### The simplest way to use it


Template pulling:

```
s init python3-http -p alibaba
```

The default configuration of yaml is as follows:

```yaml
MyFunctionDemo:
  Component: fc
  Provider: alibaba
  Properties:
    Region: cn-hangzhou
    Service:
      Name: ServerlessToolProject
      Description: Service Description
    Function:
      Name: serverless_demo_python3_http
      Description: Function Description
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

### Complete yaml example

```yaml
MyFunction:
  Component: fc
  Provider: alibaba
  Access: release
  Properties:
    Region: cn-huhehaote
    Service:
      Name: Service name
      Description: Service description
      InternetAccess: Internet access
#      Log: Auto
      Log:
        LogStore: logstore name in loghub
        Project: project name in loghub
#      Role: <Role name> or <Role ARN>
      Role: # A ram role that grants the function the required permissions to calculate
          Name: <Role name>
          Policies:
            - AliyunECSNetworkInterfaceManagementAccess
            - AliyunFCFullAccess
#      Vpc: Auto
      Vpc:
        SecurityGroupId: Security group
        VSwitchIds:
          - One or more VSwitch ID
        VpcId: VPC ID
#      Nas: Auto
#      Nas:
#        Type: Auto
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
        - Key: Tag key
          Value: Tag value
        - Key: Tag key
          Value: Tag value
    Function: 
      Name: Function name
      Description: Function description
      #      CodeUri: Local dir
      #      CodeUri:
      #        Bucket: Bucket name
      #        Object: Bucket object
      CodeUri:
        Bucket: Bucket name
        Src: Local dir
        Excludes:
          - path1
          - path2
        Includes:
          - path1
          - path2
      CAPort: 8080 # Specify port
      CustomContainer:
        Dockerfile: ./dockerfile
        CrAccount:
          User: xx  #If specified, login will be performed automatically
          Password: xx #If specified, login will be performed automatically
        Image: 'registry.cn-hangzhou.aliyuncs.com/lvwantest/nahai-repo:latest'  # 仓库地址
        Command: '[ "node"]'
        Args: '["server.js"]'
      Handler: The entry of function execution. The specific format is related to the language
      MemorySize: Memory specification of function
      InstanceConcurrency: Single instance multi concurrency
      Runtime: The running environment of function
      Environment:
        - Key: Environmentkey
          Value: EnvironmentValue
      Timeout: Time out for function to run
      Initializer:
        Handler: Initialization function implementation entry, specific format and language related
        Timeout: Initializes the timeout for the function run
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
            Qualifier: Prod # Version (optional)
        - Name: TriggerNameTimer
          Type: Timer
          Parameters:
            CronExpression: '0 0 8 * * *'
            Enable: true
            Payload: 'awesome-fc-event-nodejs10'
            Qualifier: Prod # Version (optional)
        - Name: TriggerNameHttp
          Type: HTTP # trigger type
          Parameters:
            AuthType: ANONYMOUS
            InvocationRole: Use an ARN of a ram role to specify the execution role for the function
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
                    Qualifier: Prod # Version (optional)
                  - Path: '/a'
                    Qualifier: Prod # Version (optional)
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
            FunctionParameter: The log service takes the configuration content as the function event, when the event is triggered
            InvocationRole: Use an ARN of a ram role to specify the execution role for the function
            Qualifier: Prod # Version (optional)
        - Name: TriggerNameRDS
          Type: RDS # trigger type
          Parameters:
            InstanceId: rm-12345799xyz
            SubscriptionObjects:
              - db1.table1
            Retry: 2
            Concurrency: 1
            EventFormat: json
            InvocationRole: Use an ARN of a ram role to specify the execution role for the function
            Qualifier: Prod # Version (optional)
        - Name: TriggerNameMNS
          Type: MNSTopic # trigger type
          Parameters:
            TopicName: test-topic
            Region: cn-shanghai
            NotifyContentFormat: JSON
            NotifyStrategy: BACKOFF_RETRY
            FilterTag: Describes the label for message filtering in this subscription
            InvocationRole: Use an ARN of a ram role to specify the execution role for the function
            Qualifier: Prod # Version (optional)
        - Name: TriggerNameTableStore
          Type: TableStore # trigger type
          Parameters:
            InstanceName: test-inst
            TableName: test-tbl
            InvocationRole: Use an ARN of a ram role to specify the execution role for the function
            Qualifier: Prod # Version (optional)
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
            InvocationRole: Use an ARN of a ram role to specify the execution role for the function
            Qualifier: Prod # Version (optional)
```

# Parameter details

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Region | True | Enum | Region |
| Service | True | Struct | Service Object |
| Function | True | Struct | Function object |

## Service
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | Service Name |
| Description | True | String | Short description of service |
| InternetAccess | False | Boolean | Set to true to enable function to access the public network |
| Log | False | Enum[Simple configuration]/Struct[Detailed configuration] | Log configuration. The log generated by function will be written to the logstore configured here |
| Role | False | String[Simple configuration]/Struct[Detailed configuration] | The ram role is used to grant the function calculation permission. The usage scenarios include： 1. Send the log generated by function to the user's logstore; 2. Generate token for function to access other cloud resources during execution |
| Vpc | False | Enum[Simple configuration]/Struct[Detailed configuration] | VPC configuration. After configuration, function can access the specified VPC |
| Nas | False | Enum[Simple configuration]/Struct[Semi automatic configuration]/Struct[Detailed configuration] | NAS configuration. After configuration, function can access the specified NAS |
| Tag | False | List<Struct> | Tags configuration |

### Log
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| LogStore | False | String | Logstore name in loghub |
| Project | False | String | Project name in loghub |

### Role
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | Role name |
| Policies | True | List<String> | Policy list |

### Vpc
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| SecurityGroupId | False | String | Security group ID |
| VSwitchIds | False | List<String> | One or more vswitch IDS |
| VpcId | False | String | VPC ID |

### Nas
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Type | True | Enum | Automatic configuration |
| FcDir | False | String | Function calculation directory |
| LocalDir | False | String[Single directory]/List<String>[Multi directory configuration] | Local directory |

#### MountPoints
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Alias | False | String | Aliases in effect for components |
| NasAddr | False | String | NAS server address |
| NasDir | False | String | NAS directory |
| FcDir | False | String | Function calculation directory |
| LocalDir | False | String[Single directory]/List<String>[Multi directory configuration] | Local directory |

### Nas
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| UserId | False | String | userID |
| GroupId | False | String | groupID |
| MountPoints | False | List<Struct> | Mount point |

#### MountPoints
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Alias | False | String | Aliases in effect for components |
| NasAddr | False | String | NAS server address |
| NasDir | False | String | NAS directory |
| FcDir | False | String | Function calculation directory |
| LocalDir | False | String[Single directory]/List<String>[Multi directory configuration] | Local directory |

### Tag
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Key | True | String | Tag name |
| Value | True | String | Tag value |

## Function
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | Function Name |
| Description | False | String | Short description of function |
| CodeUri | False | String[Simple configuration]/Struct[OSS deployment]/Struct[Complex configuration] | Code location |
| CAPort | False | Number | CustomContainer/Runtime Specify port |
| CustomContainer | False | Struct | Custom image configuration |
| Handler | False | String | The entry of function execution. The specific format is related to the language |
| MemorySize | False | Number | Memory specification of function |
| Runtime | False | String | Runtime |
| Timeout | False | Number | Timeout for function to run |
| InstanceConcurrency | False | Number | Single instance multi concurrency |
| Environment | False | List<Struct> | environment variable |
| Initializer | False | Struct | Initialization method |
| Triggers | False | List<Struct> | Trigger |

### CodeUri
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Bucket | False | String | bucket name for function code |
| Object | False | String | object name for code zip |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Bucket | False | String | bucket name for function code |
| Src | False | String | Local path |
| Exclude | False | List<String> | Additional removed local paths |
| Include | False | List<String> | Additional included local paths |

### CustomContainer
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CrAccount | False | Struct | Account information |
| Image | False | String | Repo url |
| Command | False | String | Command |
| Args | False | String | Args |

#### CrAccount
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| User | False | String | CrAccount |
| Password | False | String | CrAccount |

### Environment
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Key | False | String | Environment variable key |
| Value | False | String | Environment variable value |

### Initializer
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Handler | False | String | Initialization function implementation entry, specific format and language related |
| Timeout | False | String | Initializes the timeout for the function run |

### Triggers
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Name | True | String | Trigger name |
| Type | True | Enum | Trigger type |
| Parameters | True | Struct[OSS Trigger]/Struct[Timer Trigger]/Struct[CDN Trigger]/Struct[Table Store Trigger]/Struct[MNS Trigger]/Struct[RDS Trigger]/Struct[LOG Trigger]/Struct[HTTP Trigger] | Parameter type |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Bucket | True | String | the corresponding bucket name in OSS |
| Events | True | List | Events that trigger functions on the OSS side |
| Filter | True | Struct | Screening criteria |
| InvocationRole | False | String | Use the ARN of a ram role to specify the execution role for the function. The event source will use this role to trigger the function execution. Please ensure that the role has the permission to call the function |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CronExpression | False | String | Time trigger expression |
| Enable | False | Boolean | Indicates whether the trigger is enabled |
| Payload | False | String | Pass in parameters |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| EventName | True | String | The event executed by the trigger function on the CDN side cannot be changed once it is created |
| EventVersion | True | String | The version of the trigger function execution event on the CDN side cannot be changed once it is created |
| Notes | True | String | Remark |
| Filter | True | Struct | Filter (at least one filter is required) |
| InvocationRole | False | String | Use the ARN of a ram role to specify the execution role for the function. The event source will use this role to trigger the function execution. Please ensure that the role has the permission to call the function |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| InstanceName | True | String | The name of the table storage instance |
| TableName | True | String | The table name in the instance |
| InvocationRole | False | String | Use the ARN of a ram role to specify the execution role for the function. The event source will use this role to trigger the function execution. Please ensure that the role has the permission to call the function |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| TopicName | True | String | The name of MNS topic |
| Region | False | String | The region where the MNS topic is located. If it is not filled in, it defaults to the same region as the function |
| NotifyContentFormat | False | Enum | Push the format of the parameter event into the function. Optional values： stream, JSON |
| NotifyStrategy | False | Enum | The retrying policy of calling function, optional value： backoff_ RETRY, EXPONENTIAL_ DECAY_ RETRY, |
| FilterTag | False | String | Describes the label of message filtering in the subscription (messages with the same label will be pushed). If the string does not exceed 16 characters, message filtering will not be performed by default, that is, this field is not filled in by default |
| InvocationRole | False | String | Use the ARN of a ram role to specify the execution role for the function. The event source will use this role to trigger the function execution. Please ensure that the role has the permission to call the function |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| InstanceId | True | String | RDS ID |
| SubscriptionObjects | False | List<String> | The subscription object is currently supported to the table level. Only the update of these tables will trigger the function execution |
| Retry | False | Number | Number of retries, optional values [0,3], the default value is 3 |
| Concurrency | False | Enum | Call concurrency, optional value [1,5], the default value is 1 |
| EventFormat | False | Enum | Event format, optional values JSON, protobuf |
| InvocationRole | False | String | Use the ARN of a ram role to specify the execution role for the function. The event source will use this role to trigger the function execution. Please ensure that the role has the permission to call the function |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Logstore | True | String | Logstore name of the data source. The trigger will periodically subscribe data from the logstore to the function calculation |
| JobConfig | False | Struct | Contains two configurable properties |
| LogConfig | False | Struct | Contains three configurable properties |
| FunctionParameter | False | Struct | The log service takes the configuration content as the function event, and when the event is triggered, it will be sent to the function along with its content |
| Enable | False | Boolean | Indicates whether the trigger is enabled |
| InvocationRole | False | String | Use the ARN of a ram role to specify the execution role for the function. The event source will use this role to trigger the function execution. Please ensure that the role has the permission to call the function |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

#### Parameters
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| AuthType | True | Enum | Authentication type, optional values anonymous, function. |
| Methods | True | List<Enum> | Access methods supported by HTTP triggers |
| Domains | False | List<Struct>[Automatic configuration]/List<Struct>[Custom configuration] | Custom domain name configuration |
| FunctionParameter | False | Struct | The log service takes the configuration content as the function event, and when the event is triggered, it will be sent to the function along with its content |
| Enable | False | Boolean | Indicates whether the trigger is enabled |
| InvocationRole | False | String | Use the ARN of a ram role to specify the execution role for the function. The event source will use this role to trigger the function execution. Please ensure that the role has the permission to call the function |
| Qualifier | False | String | Service qualifier |

##### Filter
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Prefix | False | String | Prefix |
| Suffix | False | String | Suffix |

| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | False | List<String> | Domain |

##### JobConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| MaxRetryTime | False | String | Represents the maximum number of attempts allowed if an error is encountered during the execution of the log service trigger function |
| TriggerInterval | False | String | Represents the interval between log service trigger functions |

##### LogConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Project | False | String | Represents the log service project name |
| LogStore | False | String | Indicates that when the trigger function is executed, the generated log will be recorded to the logstore |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |

##### Domains
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Domain | True | String | Domain |
| Protocol | True | List<Enum> | Protocol |
| CertConfig | False | Struct | Domain name certificate |
| Routes | False | List<Struct> | Path configuration |

###### CertConfig
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| CertName | False | String | Name |
| PrivateKey | False | String | Private key |
| Certificate | False | String | Certificate |

###### Routes
| Name |  Required  |  Type  |  Description  |
| --- |  ---  |  ---  |  ---  |
| Path | False | String | Path |
| Qualifier | False | String | Service qualifier |