'use strict'

var dgram = require('dgram')
var SequenceStream = require('../sequence-stream')
var aes = require('../aes')
var debug = require('../debug')

exports.start = function (session, uri, cb) {
  var server = dgram.createSocket('udp4')
  var conf = session.uris[uri]

  var rtpStream = new SequenceStream(session)
  rtpStream.pipe(session.decoder)

  server.on('message', function (msg, rinfo) {
    var seq = msg.readUInt16BE(2)
    var body = aes(msg, conf.aeskey, conf.aesiv)
    session.decoder.packets(body.length)
    rtpStream.add(seq, body)
  })

  var port = 53561
  server.bind(port, function () {
    var port = server.address().port
    debug('RTP server listening on port %s', port)
    cb(null, port)
  })
}
