import merge from 'ts-deepmerge'
import { readFileSync } from 'fs'
import { SocksClient } from 'socks'
import * as dns from 'dns'
import * as net from 'net'
import Https from 'https'

import type { BotOptions } from 'mineflayer'
import type { ServerOptions, Client } from 'minecraft-protocol'
import type { Options } from '../types/options'


function httpConstruct (
  protocol: 'https' | 'http',
  dest: { host: string, port: number },
  opts: {
    host: string
    port: number
    username?: string
    password?: string
  }
) {
  return {
    connect: (client: Client) => {
      if (opts.port === 25565 && net.isIP(opts.host) === 0 && opts.host !== 'localhost') {
        // Try to resolve SRV records for the comain
        dns.resolveSrv('_minecraft._tcp.' + opts.host, (err, addresses) => {
          // Error resolving domain
          if (err != null) {
            // Could not resolve SRV lookup, connect directly
            client.setSocket(net.connect(opts.port, opts.host))
            return
          }

          // SRV Lookup resolved conrrectly
          if (addresses && addresses.length > 0) {
            opts.host = addresses[0].name
            opts.port = addresses[0].port
            const req = Https.request({
              ...opts,
              method: 'CONNECT',
              path: dest.host + ':' + dest.port
            })
            req.end()

            req.on('connect', (res, stream) => {
              client.setSocket(stream)
              client.emit('connect')
            })
          } else {
            // Otherwise, just connect using the provided hostname and port
            client.setSocket(net.connect(opts.port, opts.host))
          }
        })
      } else {
        // Otherwise, just connect using the provided hostname and port
        client.setSocket(net.connect(opts.port, opts.host))
      }
    }
    // agent: new ProxyAgent({ protocol, ...opts }) as Agent,
  }
}

function socksConstruct (
  protocol: 'socks4' | 'socks5' | 'socks5h',
  dest: { host: string, port: number },
  opts: {
    host: string
    port: number
    username?: string
    password?: string
  }
) {
  const numType = protocol.includes('socks5') ? 5 : 4
  return {
    connect: (client: Client) => {
      if (dest.port === 25565 && net.isIP(dest.host) === 0 && dest.host !== 'localhost') {
        // Try to resolve SRV records for the comain

        dns.resolveSrv('_minecraft._tcp.' + dest.host, (err, addresses) => {
          // Error resolving domain
          if (err != null) {
            // Could not resolve SRV lookup, connect directly
            client.setSocket(net.connect(dest.port, dest.host))
            return
          }

          // SRV Lookup resolved conrrectly
          if (addresses && addresses.length > 0) {
            dest.host = addresses[0].name
            dest.port = addresses[0].port

            SocksClient.createConnection(
              {
                proxy: {
                  ...opts,
                  type: numType,
                  userId: opts.username // changed name
                },
                command: 'connect',
                destination: dest
              },
              (err, info) => {
                if (err != null) throw err
                client.setSocket(info!.socket)
                client.emit('connect')
              }
            )
          } else {
            // Otherwise, just connect using the provided hostname and port
            client.setSocket(net.connect(dest.port, dest.host))
          }
        })
      } else {
        // Otherwise, just connect using the provided hostname and port
        client.setSocket(net.connect(dest.port, dest.host))
      }
    }
    // agent: new ProxyAgent({ protocol: 'socks5', ...opts }) as Agent,
  }
}

function proxyConstruct (
  protocol: 'https' | 'http' | 'socks4' | 'socks5' | 'socks5h',
  dest: { host: string, port: number },
  opts: {
    host: string
    port: number
    username?: string
    password?: string
  }
) {
  switch (protocol) {
    case 'http':
    case 'https':
      return httpConstruct(protocol, dest, opts)
    case 'socks4':
    case 'socks5':
    case 'socks5h':
      return socksConstruct(protocol, dest, opts)
  }
}

export function botOptsFromConfig (opts: Options): BotOptions {
  let ret = merge(opts.minecraft.account, opts.minecraft.remoteServer)
  if (ret.auth === 'microsoft') {
    delete ret.password // Allows for first-time microsoft sign-in.
  }
  
  if (opts.minecraft.proxy != null && opts.minecraft.proxy.enabled) {
    ret = merge(
      ret,
      proxyConstruct(opts.minecraft.proxy.protocol, opts.minecraft.remoteServer, opts.minecraft.proxy.info)
    )
  }
  return ret
}

async function getIcon (iconInfo?: string) {
  if (iconInfo) {
    if (iconInfo.startsWith('http://') || iconInfo.startsWith('https://')) {
      return 'data:image/png;base64,' + (await getImgBuf(iconInfo)).toString('base64')
    } else if (iconInfo.startsWith('data:')) {
      return iconInfo
    } else {
      return 'data:image/png;base64,' + readFileSync(iconInfo).toString('base64')
    }
  } else {
    return 'data:image/png;base64,' + readFileSync('./static/assets/2b2w-small.png').toString('base64')
  }
}

export async function serverOptsFromConfig (opts: Options): Promise<ServerOptions> {
  const serverOpts: ServerOptions = opts.localServer
  serverOpts.favicon = await getIcon(opts.localServer?.favicon)
  return serverOpts
}

async function getImgBuf (url: string) {
  return await new Promise((res: (value: Buffer) => void, rej) => {
    Https.get(url, function (response) {
      if (response.statusCode === 200) {
        const data: Buffer[] = []

        response.on('data', function (chunk) {
          data.push(chunk)
        })

        response.on('end', function () {
          res(Buffer.concat(data))
        })
      } else {
        response.resume()
        rej(new Error(`Request failed with status code: ${response.statusCode}`))
      }
    }).end()
  })
}
