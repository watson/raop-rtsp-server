'use strict'

var dgram = require('dgram')
var aes = require('../aes')
var debug = require('../debug')

exports.start = function (session, uri, cb) {
  var server = dgram.createSocket('udp4')
  var conf = session.uris[uri]

  server.on('message', function (msg, rinfo) {
    debug('New RTP control message', msg, rinfo)
    var payloadType = msg.readUInt8(1) & 127
    if (payloadType === 86) {
      var seq = msg.readUInt16BE(6)
      debug('received retransmitted audio packet (seq: %d)', seq)
      var body = aes(msg, conf.aeskey, conf.aesiv, 16)
      session.add(seq, body)
    }
  })

  var port = 63379
  server.bind(port, function () {
    var addr = server.address()
    debug('RTP Control server listening', addr)
    cb(null, addr.port)
  })
}
