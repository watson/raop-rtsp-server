'use strict'

var util = require('util')
var dgram = require('dgram')
var crypto = require('crypto')
var afterAll = require('after-all-results')
var rtsp = require('rtsp-server')
var mdns = require('raop-mdns-server')
var sdp = require('sdp-transform')
var alac = require('libalac')
var auth = require('./lib/auth')
var sessions = require('./lib/sessions')
var rsa = require('./lib/rsa')
var SequenceStream = require('./lib/sequence-stream')
var debug = require('./lib/debug')
var pkg = require('./package')

var SUPPORTED_METHODS = ['ANNOUNCE', 'SETUP', 'RECORD', 'PAUSE', 'FLUSH', 'TEARDOWN', 'OPTIONS', 'GET_PARAMETER', 'SET_PARAMETER', 'POST', 'GET']
var serverAgent = 'AirTunes/105.1'
var macAddr
var stdout = process.argv[2] === '--stdout'

var server = rtsp.createServer(function (req, res) {
  res.setHeader('Server', serverAgent)

  if (!~SUPPORTED_METHODS.indexOf(req.method)) {
    res.statusCode = 501 // Not Implemented
    res.end()
    return
  }

  methods[req.method.toLowerCase()](req, res)
})

server.listen(5000, function () {
  var port = server.address().port
  debug('RAOP RTSP server listening on port %d', port)

  var txt = {
    txtvers: '1',
    ch: '2',
    cn: '0,1',
    ek: '1',
    et: '0,1',
    sv: 'false',
    da: 'true',
    sr: '44100',
    ss: '16',
    pw: 'false',
    vn: '65537',
    tp: 'TCP,UDP',
    vs: '105.1',
    am: 'AirPort4,107',
    fv: '76400.10',
    sf: '0x0'
  }

  mdns({ name: pkg.name, port: port, txt: txt }, function (err, result) {
    if (err) throw err
    macAddr = result.mac
  })
})

var methods = {
  options: function (req, res) {
    res.setHeader('Public', SUPPORTED_METHODS.join(', '))

    var challenge = req.headers['apple-challenge']
    if (challenge) {
      var response = auth(challenge, req.socket.localAddress, macAddr)
      res.setHeader('Apple-Response', response)
    }

    res.end()
  },

  announce: function (req, res) {
    if (req.headers['content-type'] !== 'application/sdp') {
      res.statusCode = 415 // Unsupported Media Type
      res.end()
      return
    }

    var buffers = []
    req.on('data', buffers.push.bind(buffers))
    req.on('end', function () {
      var conf = sdp.parse(Buffer.concat(buffers).toString())
      sessions.uri(req.uri, conf)

      // fmtp:96 352 0 16 40 10 14 2 255 0 0 44100
      var fmtp = conf.media[0].fmtp[0].config.split(' ')

      var frameLength = parseInt(fmtp[0], 10)       // 32 bit
      var compatibleVersion = parseInt(fmtp[1], 10) // 8 bit
      var bitDepth = parseInt(fmtp[2], 10)          // 8 bit
      var pb = parseInt(fmtp[3], 10)                // 8 bit
      var mb = parseInt(fmtp[4], 10)                // 8 bit
      var kb = parseInt(fmtp[5], 10)                // 8 bit
      var channels = parseInt(fmtp[6], 10)          // 8 bit
      var maxRun = parseInt(fmtp[7], 10)            // 16 bit
      var maxFrameBytes = parseInt(fmtp[8], 10)     // 32 bit
      var avgBitRate = parseInt(fmtp[9], 10)        // 32 bit
      var sampleRate = parseInt(fmtp[10], 10)       // 32 bit

      var cookie = new Buffer(24)
      cookie.writeUInt32BE(frameLength, 0)
      cookie.writeUInt8(compatibleVersion, 4)
      cookie.writeUInt8(bitDepth, 5)
      cookie.writeUInt8(pb, 6)
      cookie.writeUInt8(mb, 7)
      cookie.writeUInt8(kb, 8)
      cookie.writeUInt8(channels, 9)
      cookie.writeUInt16BE(maxRun, 10)
      cookie.writeUInt32BE(maxFrameBytes, 12)
      cookie.writeUInt32BE(avgBitRate, 16)
      cookie.writeUInt32BE(sampleRate, 20)
      conf.cookie = cookie

      debug('ALAC magic cookie', cookie)

      conf.alac_dec = alac.decoder({
        cookie: cookie,
        channels: channels,
        bitDepth: bitDepth,
        framesPerPacket: frameLength
      })

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
  },

  setup: function (req, res) {
    if (req.headers['require'] && !~SUPPORTED_METHODS.indexOf(req.headers['require'])) {
      res.statusCode = 551 // Option not supported
      res.setHeader('Unsupported', req.headers['require'])
      res.end()
      return
    }

    var session = sessions.get(req, true)

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

    startRTPServer(session, req.uri, next())
    startControlServer(session, req.uri, next())
    startTimingServer(session, req.uri, next())
  },

  record: function (req, res) {
    var session = sessions.get(req)

    session.rtpInfo = splitter(req.headers['rtp-info'])
    session.rtpInfo.seq = parseInt(session.rtpInfo.seq, 10)

    res.setHeader('Audio-Latency', 2205) // TODO: Use actual latency instead
    res.end()
  },

  pause: function (req, res) {
    res.end()
  },

  flush: function (req, res) {
    res.end()
  },

  teardown: function (req, res) {
    sessions.end(req)
    res.end()
  },

  set_parameter: function (req, res) {
    res.end()
  },

  get_parameter: function (req, res) {
    res.end()
  },

  post: function (req, res) {
    res.end()
  },

  get: function (req, res) {
    res.end()
  }
}

function splitter (str) {
  var result = {}
  str.split(';').forEach(function (pair) {
    pair = pair.split('=')
    result[pair[0]] = pair[1] || true
  })
  return result
}

function startRTPServer (session, uri, cb) {
  var server = dgram.createSocket('udp4')
  var conf = session.uris[uri]

  var rtpStream = new SequenceStream(session)

  if (stdout) rtpStream.pipe(conf.alac_dec).pipe(process.stdout)
  else rtpStream.pipe(conf.alac_dec).resume()

  server.on('message', function (msg, rinfo) {
    var seq = msg.readUInt16BE(2)
    var body = decode_aes(msg)
    conf.alac_dec.packets(body.length)
    rtpStream.add(seq, body)
  })

  var port = 53561
  server.bind(port, function () {
    var port = server.address().port
    debug('RTP server listening on port %s', port)
    cb(null, port)
  })

  function decode_aes (data) {
    var size = data.length - 12
    var tmp = new Buffer(16)
    var out = new Buffer(size)
    var remainder = size % 16
    var encLength = size - remainder

    // TODO: Can this be moved outside of this function?
    var decipher = crypto.createDecipheriv('aes-128-cbc', conf.aeskey, conf.aesiv)
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
}

function startControlServer (session, uri, cb) {
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

function startTimingServer (session, uri, cb) {
  var server = dgram.createSocket('udp4')

  server.on('message', function (msg, rinfo) {
    debug('New RTP timing message', msg, rinfo)
  })

  var port = 50607
  server.bind(port, function () {
    var port = server.address().port
    debug('RTP Timing server listening on port %s', port)
    cb(null, port)
  })
}
