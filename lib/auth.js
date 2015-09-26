'use strict'

var ipaddr = require('ipaddr.js')
var debug = require('./debug')

var rsa = require('./rsa')

module.exports = function (challenge, ip, mac) {
  debug('Encrypting auth challenge response', challenge, ip, mac)

  challenge = new Buffer(challenge, 'base64')
  ip = new Buffer(ipaddr.parse(ip).toByteArray())
  mac = new Buffer(mac.replace(/:/g, ''), 'hex')

  if (challenge.length > 16) throw new Error('Challenge is longer than 16 bytes')

  var buff = new Buffer(32)
  buff.fill(0)

  challenge.copy(buff)
  ip.copy(buff, challenge.length)
  mac.copy(buff, challenge.length + ip.length)

  return rsa.encryptPrivate(buff, 'base64')
}
