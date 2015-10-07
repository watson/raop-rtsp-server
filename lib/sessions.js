'use strict'

var util = require('util')
var dgram = require('dgram')
var stream = require('readable-stream')
var EventEmitter = require('events').EventEmitter
var uuid = require('node-uuid')
var SequenceStream = require('./sequence-stream')
var debug = require('./debug')

var pool = {}

// Reverse lookup session based on the Active-Remote. Useful when dealing with
// iOS, which doesn't seem to use the session headers.
var sessionMap = {}

var sessions = module.exports = new EventEmitter()

sessions.get = function (req) {
  // prefer a proper Session header
  var id = req.headers['session']
  if (id) return pool[id]
  // fall back to Active-Remote header (this is non-standard RTSP)
  var remote = req.headers['active-remote']
  if (remote) return pool[sessionMap[remote]]
  throw new Error('Unknown session')
}

sessions.upsert = function (req) {
  var session = this.get(req)
  if (session) return session
  var id = uuid.v4()
  session = pool[id] = new Session(id)
  var remote = req.headers['active-remote']
  if (remote) sessionMap[remote] = id
  debug('new session', id)
  this.emit('new', session)
  return session
}

sessions.setConf = function (req, conf) {
  this.upsert(req).uris[req.uri] = conf
}

sessions.end = function (req) {
  var id = req.headers['session']
  var remote = req.headers['active-remote']
  debug('clearing session', id)
  if (id) delete pool[id]
  if (remote) delete sessionMap[remote]
}

var Session = function (id, opts) {
  if (!(this instanceof Session)) return new Session(id, opts)

  stream.PassThrough.call(this, opts)

  this.id = id
  this.uris = {}
  this.volumeDb = 0
  this.volume = 1
  this._rtpStream = new SequenceStream(this)
  this._controlSeqNo = 0

  this._rtpStream.on('missing', this._retransmit.bind(this))
}

util.inherits(Session, stream.PassThrough)

Session.prototype.setDecoder = function (decoder) {
  this._decoder = decoder
  this._rtpStream.on('data', function (chunk) {
    decoder.packets(chunk.length)
    decoder.write(chunk)
  })
  decoder.pipe(this)
}

Session.prototype.setVolume = function (volume) {
  debug('new volume level', volume)
  this.volumeDb = volume
  this.volume = volume <= -144 ? 0 : Math.pow(10, 0.05 * volume)
  this.emit('volume', volume)
}

Session.prototype.add = function (seq, chunk) {
  this._rtpStream.add(seq, chunk)
}

Session.prototype._retransmit = function (seq) {
  var buff = new Buffer(8)
  buff.writeUInt8(128, 0)
  buff.writeUInt8(128 + 85, 1) // 85 = retransmit query
  buff.writeUInt16BE(this._controlSeqNo++, 2)
  buff.writeUInt16BE(seq, 4)
  buff.writeUInt16BE(1, 6)

  var client = dgram.createSocket('udp4')
  debug('requesting retransmit of sequence %d from %s:%s', seq, this.rinfo.address, this.transport.control_port)
  client.send(buff, 0, 8, this.transport.control_port, this.rinfo.address, function (err) {
    if (err) throw err
    debug('retransmit request successfull')
  })
}
