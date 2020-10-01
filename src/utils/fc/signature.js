const crypto = require('crypto')
const url = require('url')

// 构造字符串的过程
function composeStringToSign (method, path, headers, queries) {
  var contentMD5 = headers['content-md5'] || ''
  var contentType = headers['content-type'] || ''
  var date = headers.date
  var signHeaders = buildCanonicalHeaders(headers, 'x-fc-')
  var u
  try {
    u = new URL(path)
  } catch (e) {
    u = url.parse(path)
  }
  var pathUnescaped = decodeURIComponent(u.pathname)
  var str = `${method}\n${contentMD5}\n${contentType}\n${date}\n${signHeaders}${pathUnescaped}`
  if (queries) {
    var params = []
    Object.keys(queries).forEach(function (key) {
      var values = queries[key]
      var type = typeof values
      if (type === 'string') {
        params.push(`${key}=${values}`)
        return
      }
      if (type === 'object' && values instanceof Array) {
        queries[key].forEach(function (value) {
          params.push(`${key}=${value}`)
        })
      }
    })
    params.sort()
    str += '\n' + params.join('\n')
  }
  return str
}

// 使用 hmac-sha256 和 base64 计算签名的过程，其中 source 参数为构造出的字符串
function signString (source, secret) {
  const buff = crypto
    .createHmac('sha256', secret)
    .update(source, 'utf8')
    .digest()
  return Buffer.from(buff, 'binary').toString('base64')
}

// javascript
// prefix = 'x-fc-'
function buildCanonicalHeaders (headers, prefix) {
  var list = []
  var keys = Object.keys(headers)
  var fcHeaders = {}
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var lowerKey = key.toLowerCase().trim()
    if (lowerKey.startsWith(prefix)) {
      list.push(lowerKey)
      fcHeaders[lowerKey] = headers[key]
    }
  }
  list.sort()
  var canonical = ''
  for (var _i = 0; _i < list.length; _i++) {
    var _key = list[_i]
    canonical += `${_key}:${fcHeaders[_key]}\n`
  }
  return canonical
}

module.exports = {
  composeStringToSign,
  signString
}
