'use strict'

var dgram = require('dgram')
var debug = require('../debug')

exports.start = function (session, uri, cb) {
  var server = dgram.createSocket('udp4')

  server.on('message', function (msg, rinfo) {
    debug('New RTP timing message', msg, rinfo)
  })

  var port = 50607
  server.bind(port, function () {
    var addr = server.address()
    debug('RTP Timing server listening', addr)
    cb(null, addr.port)
  })
}
