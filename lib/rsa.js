'use strict'

var fs = require('fs')
var NodeRSA = require('node-rsa')

var pem = fs.readFileSync('./keys/airport_rsa')

module.exports = new NodeRSA(pem)
