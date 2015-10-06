'use strict'

var util = require('util')
var stream = require('readable-stream')
var EventEmitter = require('events').EventEmitter
var uuid = require('node-uuid')
var SequenceStream = require('./sequence-stream')
var debug = require('./debug')

var uris = {} // TODO: Figure out the right connection between URI's and sessions ;)
var pool = {}

// Reverse lookup session based on the URI. Useful when dealing with iOS, which
// doesn't seem to use the session headers.
var sessionMap = {}

var sessions = module.exports = new EventEmitter()

sessions.uri = function (uri, val) {
  if (!(uri in uris)) uris[uri] = val || {}
  else if (val) uris[uri] = val
  return uris[uri]
}

sessions.init = function (req) {
  var uri = req.uri
  var id = uuid.v4()
  var session = pool[id] = new Session(id)
  session.uris[uri] = uris[uri]
  sessionMap[uri] = id
  debug('created new session', id)
  this.emit('new', session)
  return session
}

sessions.get = function (req) {
  var uri = req.uri
  var id = req.headers['session'] || sessionMap[uri]
  if (!id) return null
  var session = pool[id]
  if (!session) return null
  if (!(uri in session.uris)) session.uris[uri] = uris[uri]
  return session
}

sessions.end = function (req) {
  var id = req.headers['session']
  debug('clearing session', id)
  delete pool[id]
}

var Session = function (id, opts) {
  if (!(this instanceof Session)) return new Session(id, opts)

  stream.PassThrough.call(this, opts)

  this.id = id
  this.uris = {}
  this.volumeDb = 0
  this.volume = 1
  this._rtpStream = new SequenceStream(this)
}

util.inherits(Session, stream.PassThrough)

Session.prototype.setDecoder = function (decoder) {
  this._decoder = decoder
  this._rtpStream.pipe(decoder).pipe(this)
}

Session.prototype.add = function (seq, chunk) {
  this._decoder.packets(chunk.length) // Someone should fix this API
  this._rtpStream.add(seq, chunk)
}
