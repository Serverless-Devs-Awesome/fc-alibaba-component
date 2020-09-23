const FC = require('@alicloud/fc2')
const _ = require('lodash')

class TAG {
  constructor (credentials, region) {
    this.accountId = credentials.AccountID
    this.accessKeyID = credentials.AccessKeyID
    this.accessKeySecret = credentials.AccessKeySecret
    this.region = region
    this.fcClient = new FC(credentials.AccountID, {
      accessKeyID: credentials.AccessKeyID,
      accessKeySecret: credentials.AccessKeySecret,
      region: region,
      timeout: 60000
    })
  }

  /**
   * Remove tags
   * @param {*} resourceArn
   * @param {*} tags : Will delete all tags if not specified
   */
  async remove (resourceArn, parameters) {
    const onlyRemoveTagName = !!parameters ? (parameters.k || parameters.key) : false;
    const tagKeys = [];
    
    if (onlyRemoveTagName) {
      tagKeys.push(onlyRemoveTagName)
    } else {
      try {
        const allTags = await this.fcClient.getResourceTags({ resourceArn: resourceArn })
        if (allTags.data && allTags.data.tags) {
          const tagsAttr = allTags.data.tags
          for (const key in tagsAttr) {
            tagKeys.push(key)
          }
        }
      } catch (ex) {
        throw new Error(`Unable to get tags: ${ex.message}`)
      }
    }

    console.log('Tags: untag resource: ', tagKeys)
    await this.fcClient.untagResource(resourceArn, tagKeys)
    console.log('Tags: untag resource successfully: ', tagKeys)
  }

  async deploy (resourceArn, tagsInput, commands, parameters) {
    const isOnlyDeployTags = _.isArray(commands) && commands[0] === 'tags'
    let onlyDeployTagName
    if (isOnlyDeployTags && (parameters.k || parameters.key)) {
      onlyDeployTagName = parameters.k || parameters.key
    }
    let tags = {}
    // tags格式化
    tagsInput.forEach(({ Key, Value }) => {
      if (Key !== undefined) {
        tags[Key] = Value
      }
    })
    if (onlyDeployTagName) {
      if (!_.has(tags, onlyDeployTagName)) {
        throw new Error(`${onlyDeployTagName} not found.`)
      }
      tags = {
        [onlyDeployTagName]: tags[onlyDeployTagName]
      }
    }

    let tagsAttr
    try {
      const tempTags = await this.fcClient.getResourceTags({ resourceArn: resourceArn })
      tagsAttr = tempTags.data.tags
    } catch (ex) {
      tagsAttr = {}
    }

    // 删除标签
    const untagResourceKeys = []
    for (const item in tagsAttr) {
      if (!(_.has(tags, item) && tags[item] === tagsAttr[item])) {
        untagResourceKeys.push(item)
      }
    }
    if (untagResourceKeys.length > 0) {
      console.log('Tags: untag resource: ', untagResourceKeys)
      await this.fcClient.untagResource(resourceArn, untagResourceKeys)
    }

    // 打标签
    console.log('Tags: tagging resource ...')
    await this.fcClient.tagResource(resourceArn, tags)

    return tags
  }
}

module.exports = TAG
