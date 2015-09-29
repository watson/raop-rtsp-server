'use strict'

var fs = require('fs')
var path = require('path')

var NodeRSA = require('node-rsa')

var pem = fs.readFileSync(path.join(__dirname, '../keys/airport_rsa'))

module.exports = new NodeRSA(pem)
