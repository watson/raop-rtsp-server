'use strict'

var util = require('util')
var afterAll = require('after-all-results')
var sdp = require('sdp-transform')
var alac = require('libalac')
var rtpServer = require('./servers/rtp')
var rtpControlServer = require('./servers/rtp-control')
var timingServer = require('./servers/timing')
var auth = require('./auth')
var sessions = require('./sessions')
var rsa = require('./rsa')

var METHODS = exports.METHODS = ['ANNOUNCE', 'SETUP', 'RECORD', 'PAUSE', 'FLUSH', 'TEARDOWN', 'OPTIONS', 'GET_PARAMETER', 'SET_PARAMETER', 'POST', 'GET']

exports.options = function (req, res) {
  res.setHeader('Public', METHODS.join(', '))

  var challenge = req.headers['apple-challenge']
  if (challenge) {
    var response = auth(challenge, req.socket.localAddress, global._raopMacAddr)
    res.setHeader('Apple-Response', response)
  }

  res.end()
}

exports.announce = function (req, res) {
  if (req.headers['content-type'] !== 'application/sdp') {
    res.statusCode = 415 // Unsupported Media Type
    res.end()
    return
  }

  var buffers = []
  req.on('data', buffers.push.bind(buffers))
  req.on('end', function () {
    var conf = sdp.parse(Buffer.concat(buffers).toString())
    sessions.setConf(req, conf)

    // fmtp:96 352 0 16 40 10 14 2 255 0 0 44100
    var fmtp = conf.media[0].fmtp[0].config.split(' ')

    // for detailed info about the ALAC cookie, see:
    // https://alac.macosforge.org/trac/browser/trunk/ALACMagicCookieDescription.txt
    conf.alac = {
      frameLength: parseInt(fmtp[0], 10),       // 32 bit
      compatibleVersion: parseInt(fmtp[1], 10), // 8 bit
      bitDepth: parseInt(fmtp[2], 10),          // 8 bit
      pb: parseInt(fmtp[3], 10),                // 8 bit
      mb: parseInt(fmtp[4], 10),                // 8 bit
      kb: parseInt(fmtp[5], 10),                // 8 bit
      channels: parseInt(fmtp[6], 10),          // 8 bit
      maxRun: parseInt(fmtp[7], 10),            // 16 bit
      maxFrameBytes: parseInt(fmtp[8], 10),     // 32 bit
      avgBitRate: parseInt(fmtp[9], 10),        // 32 bit
      sampleRate: parseInt(fmtp[10], 10)        // 32 bit
    }

    var rsaaeskey, aesiv
    conf.media[0].invalid.forEach(function (obj) {
      var pair = obj.value.split(':')
      switch (pair[0]) {
        case 'rsaaeskey':
          rsaaeskey = pair[1]
          break
        case 'aesiv':
          aesiv = pair[1]
          break
      }
    })
    conf.aeskey = rsa.decrypt(new Buffer(rsaaeskey, 'base64'))
    conf.aesiv = new Buffer(aesiv, 'base64')

    res.end()
  })
}

exports.setup = function (req, res) {
  if (req.headers['require'] && !~METHODS.indexOf(req.headers['require'])) {
    res.statusCode = 551 // Option not supported
    res.setHeader('Unsupported', req.headers['require'])
    res.end()
    return
  } else if (req.headers['session']) {
    res.statusCode = 459 // Aggregate Operation Not Allowed
    res.end()
    return
  }

  var session = sessions.upsert(req)
  var conf = session.uris[req.uri]

  var cookie = new Buffer(24)
  cookie.writeUInt32BE(conf.alac.frameLength, 0)
  cookie.writeUInt8(conf.alac.compatibleVersion, 4)
  cookie.writeUInt8(conf.alac.bitDepth, 5)
  cookie.writeUInt8(conf.alac.pb, 6)
  cookie.writeUInt8(conf.alac.mb, 7)
  cookie.writeUInt8(conf.alac.kb, 8)
  cookie.writeUInt8(conf.alac.channels, 9)
  cookie.writeUInt16BE(conf.alac.maxRun, 10)
  cookie.writeUInt32BE(conf.alac.maxFrameBytes, 12)
  cookie.writeUInt32BE(conf.alac.avgBitRate, 16)
  cookie.writeUInt32BE(conf.alac.sampleRate, 20)

  session.setDecoder(alac.decoder({
    cookie: cookie,
    channels: conf.alac.channels,
    bitDepth: conf.alac.bitDepth,
    framesPerPacket: conf.alac.frameLength
  }))

  // RTP/AVP/UDP;unicast;interleaved=0-1;mode=record;control_port=6001;timing_port=6002
  session.transport = splitter(req.headers['transport'])

  var next = afterAll(function (err, results) {
    if (err) throw err
    var transport = util.format('RTP/AVP/UDP;unicast;mode=record;server_port=%s;control_port=%s;timing_port=%s', results[0], results[1], results[2])
    res.setHeader('Session', session.id)
    res.setHeader('Transport', transport)
    res.setHeader('Audio-Jack-Status', 'connected') // possible values: connected, disconnected
    res.end()
  })

  rtpServer.start(session, req.uri, next())
  rtpControlServer.start(session, req.uri, next())
  timingServer.start(session, req.uri, next())
}

exports.record = function (req, res) {
  if (req.headers['rtp-info']) {
    var session = sessions.upsert(req)
    session.rtpInfo = splitter(req.headers['rtp-info'])
    session.rtpInfo.seq = parseInt(session.rtpInfo.seq, 10)
  }

  res.setHeader('Audio-Latency', 2205) // TODO: Use actual latency instead
  res.end()
}

exports.pause = function (req, res) {
  res.end()
}

exports.flush = function (req, res) {
  res.end()
}

exports.teardown = function (req, res) {
  sessions.end(req)
  res.end()
}

exports.set_parameter = function (req, res) {
  var buffers = []
  req.on('data', buffers.push.bind(buffers))
  req.on('end', function () {
    var body = Buffer.concat(buffers).toString()
    body.split('\r\n').forEach(function (line) {
      var pair = line.split(': ')
      if (pair[0] === 'volume') {
        var volume = parseFloat(pair[1])
        sessions.get(req).setVolume(volume)
      }
    })
    res.end()
  })
}

exports.get_parameter = function (req, res) {
  var buffers = []
  req.on('data', buffers.push.bind(buffers))
  req.on('end', function () {
    var body = Buffer.concat(buffers).toString()
    body.split('\r\n').forEach(function (line) {
      if (line === 'volume') {
        var session = sessions.get(req)
        res.write('volume: %s', session.volumeDb.toFixed(6))
      }
    })
    res.end()
  })
}

exports.post = function (req, res) {
  res.end()
}

exports.get = function (req, res) {
  res.end()
}

function splitter (str) {
  var result = {}
  str.split(';').forEach(function (pair) {
    pair = pair.split('=')
    result[pair[0]] = pair[1] || true
  })
  return result
}
