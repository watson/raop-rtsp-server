'use strict'

var util = require('util')
var stream = require('readable-stream')
var debug = require('./debug')

var SequenceStream = module.exports = function (opts) {
  if (!(this instanceof SequenceStream)) return new SequenceStream(opts)

  stream.Readable.call(this, opts)
  this._lastSeq = null
  this._flowing = false
  this._queue = []
  this._unorderd = []
  this._haveUnordered = false
}

util.inherits(SequenceStream, stream.Readable)

SequenceStream.prototype.add = function (seq, payload) {
  var self = this

  if (this._lastSeq === null) {
    this._lastSeq = seq - 1
    debug('no start sequence given - defauling to %d', this._lastSeq)
  }

  if (this._lastSeq + 1 !== seq) {
    debug('received out of order datagram %s - queueing', seq)
    this._haveUnordered = true
    this._unorderd.push([seq, payload])
    return
  }

  this._next(payload)
  this._lastSeq = seq

  if (this._haveUnordered) {
    this._unorderd = this._unorderd
      .sort(function (a, b) {
        return a[0] - b[0]
      })
      .filter(function (arr) {
        if (self._lastSeq + 1 !== arr[0]) return false
        self._next(arr[1])
        self._lastSeq = arr[0]
        return true
      })
    this._haveUnordered = this._unorderd.length > 0
  }
}

SequenceStream.prototype._next = function (payload) {
  if (this._flowing) {
    if (!this.push(payload)) {
      debug('back pressure detected!')
      this._flowing = false
    }
  }
  else this._queue.push(payload)
}

SequenceStream.prototype._read = function () {
  if (!this._flowing) debug('entering flowing mode...')
  this._flowing = true
  if (this._queue.length === 0) return
  this._next(this._queue.shift()[1])
}
