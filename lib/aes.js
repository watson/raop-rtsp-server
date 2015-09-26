'use strict'

var crypto = require('crypto')

module.exports = function (data, key, iv) {
  var size = data.length - 12
  var tmp = new Buffer(16)
  var out = new Buffer(size)
  var remainder = size % 16
  var encLength = size - remainder

  // TODO: Can this be moved outside of this function?
  var decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
  decipher.setAutoPadding(false)

  for (var i = 0, l = encLength - 16; i <= l; i += 16) {
    data.copy(tmp, 0, i + 12, i + 12 + 16)
    decipher.update(tmp).copy(out, i, 0, 16)
  }

  // TODO: This returns a buffer, but will it ever not be empty and do we even need to call it?
  if (decipher.final().length) throw new Error('Unexpected ending of AES decryption')

  if (remainder) data.copy(out, size - remainder, size + 12 - remainder, size + 12)

  return out
}
