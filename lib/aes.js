'use strict'

var crypto = require('crypto')

var tmp = new Buffer(16)

module.exports = function (data, key, iv) {
  var remainder = (data.length - 12) % 16
  var endOfEncodedData = data.length - remainder

  // TODO: Can this be moved outside of this function?
  var decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
  decipher.setAutoPadding(false)

  for (var i = 12, l = endOfEncodedData - 16; i <= l; i += 16) {
    data.copy(tmp, 0, i, i + 16)
    decipher.update(tmp).copy(data, i, 0, 16)
  }

  // TODO: This returns a buffer, but will it ever not be empty and do we even need to call it?
  if (decipher.final().length) throw new Error('Unexpected ending of AES decryption')

  return data.slice(12)
}
