'use strict'

var dgram = require('dgram')
var aes = require('../aes')
var debug = require('../debug')

exports.start = function (session, uri, cb) {
  var server = dgram.createSocket('udp4')
  var conf = session.uris[uri]

  server.on('message', function (msg, rinfo) {
    var seq = msg.readUInt16BE(2)
    var body = aes(msg, conf.aeskey, conf.aesiv)
    session.add(seq, body)
  })

  var port = 53561
  server.bind(port, function () {
    var addr = server.address()
    debug('RTP server listening', addr)
    cb(null, addr.port)
  })
}
