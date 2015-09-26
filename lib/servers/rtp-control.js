'use strict'

var dgram = require('dgram')
var debug = require('../debug')

exports.start = function (session, uri, cb) {
  var server = dgram.createSocket('udp4')

  server.on('message', function (msg, rinfo) {
    debug('New RTP control message', msg, rinfo)
  })

  var port = 63379
  server.bind(port, function () {
    var port = server.address().port
    debug('RTP Control server listening on port %s', port)
    cb(null, port)
  })
}
