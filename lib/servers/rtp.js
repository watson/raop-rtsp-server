'use strict'

var dgram = require('dgram')
var SequenceStream = require('../sequence-stream')
var aes = require('../aes')
var debug = require('../debug')

var stdout = process.argv[2] === '--stdout'

exports.start = function (session, uri, cb) {
  var server = dgram.createSocket('udp4')
  var conf = session.uris[uri]

  var rtpStream = new SequenceStream(session)

  if (stdout) rtpStream.pipe(session.alac_dec).pipe(process.stdout)
  else rtpStream.pipe(session.alac_dec).resume()

  server.on('message', function (msg, rinfo) {
    var seq = msg.readUInt16BE(2)
    var body = aes(msg, conf.aeskey, conf.aesiv)
    session.alac_dec.packets(body.length)
    rtpStream.add(seq, body)
  })

  var port = 53561
  server.bind(port, function () {
    var port = server.address().port
    debug('RTP server listening on port %s', port)
    cb(null, port)
  })
}
