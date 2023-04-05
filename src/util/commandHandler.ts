import { TypedEventEmitter } from './utilTypes'
import { ProxyServer } from '../localServer/baseServer'
import { PacketMeta, ServerClient } from 'minecraft-protocol'
import type { Block } from 'prismarine-block'
import { Client, PacketMiddleware } from '@rob9315/mcproxy'
import { sleep } from './index'

interface CommandHandlerEvents {
  command: (cmd: string, func?: Function) => void
}

type CommandFunc = (client: Client | ServerClient, ...args: string[]) => void
type CommandInfo = {
  usage?: string
  description?: string
  allowed?: (client: Client | ServerClient) => boolean,
  callable: CommandFunc
}
| CommandFunc
export interface CommandMap {
  [key: string]:
  CommandInfo
}

export class CommandHandler<Server extends ProxyServer<any, any>> extends TypedEventEmitter<CommandHandlerEvents> {
  private _prefix: string = '/'

  private readonly mostRecentTab: Map<string, string> = new Map()

  public get prefix () {
    return this._prefix
  }

  public set prefix (prefix: string) {
    this.cleanupCmds(this._prefix, prefix)
    this._prefix = prefix
  }

  constructor (
    private readonly srv: Server,
    prefix: string = '/',
    public readonly proxyCmds: CommandMap = {},
    public readonly disconnectedCmds: CommandMap = {}
  ) {
    super()
    this.prefix = prefix
    this.loadProxyCommands({
      phelp: {
        usage: 'phelp',
        description: 'This proxy help message',
        callable: this.printHelp
      },
      pusage: {
        usage: 'pusage [cmd]',
        description: 'Gets the usage of a specific command',
        callable: this.printUsage
      }
    })
    this.loadDisconnectedCommands({
      phelp: {
        usage: 'phelp',
        description: 'This proxy help message',
        callable: this.printHelp
      }
    })
  }

  public getAllCmds() {
    return {
      connected: this.proxyCmds,
      disconnected: this.disconnectedCmds
    }
  }

  private cleanupCmds (oldPrefix: string, newPrefix: string) {
    const allCmds = this.getAllCmds();
    for (let cmdType of Object.keys(allCmds)) {
      for (let key of Object.keys((allCmds as any)[cmdType])) {
        if (key.startsWith(oldPrefix)) {
          const oldKey = key
          key = key.substring(this.prefix.length)
          this.proxyCmds[newPrefix + key] = this.proxyCmds[oldKey]
          delete this.proxyCmds[oldKey]
        } else if (!key.startsWith(newPrefix)) {
          this.proxyCmds[newPrefix + key] = this.proxyCmds[key]
          delete this.proxyCmds[key]
        }
      }
      }
     
  }

  public getActiveCmds (client: Client | ServerClient) {
    const cmds = this.srv.isProxyConnected() ? this.proxyCmds : this.disconnectedCmds;

    for (const [key, cmd] of Object.entries(cmds)) {
      if (typeof cmd !== 'function') {
        if (cmd.allowed != null && cmd.allowed(client) === false) delete cmds[key];
      }
    }

    return cmds;
  }

  loadProxyCommands (obj: CommandMap) {
    for (const entry of Object.entries(obj)) {
      const key = entry[0].startsWith(this.prefix) ? entry[0] : this.prefix + entry[0]
      this.proxyCmds[key] = entry[1]
    }
  }

  loadProxyCommand (key: string, info: CommandInfo) {
    this.proxyCmds[this.prefix + key] = info
  }

  loadDisconnectedCommands (obj: CommandMap) {
    for (const entry of Object.entries(obj)) {
      const key = entry[0].startsWith(this.prefix) ? entry[0] : this.prefix + entry[0]
      this.disconnectedCmds[key] = entry[1]
    }
  }

  loadDisconnectedCommand (key: string, info: CommandInfo) {
    this.disconnectedCmds[this.prefix + key] = info
  }

  commandHandler = async (client: Client | ServerClient, ...cmds: string[]) => {
    const allowedCmds = this.getActiveCmds(client);
    if (cmds.length === 1) {
      const [cmd, ...args] = cmds[0].split(' ')
      if (!cmd.startsWith(this.prefix)) return true
      const cmdFunc = allowedCmds[cmd]
      if (cmdFunc) this.executeCmd(cmdFunc, client, ...args)
      return !cmdFunc
    } else {
      for (const cmdLine of cmds) {
        let [cmd, ...args] = cmdLine.trimStart().split(' ')
        if (!cmd.startsWith(this.prefix)) cmd = this.prefix + cmd
        const cmdFunc = allowedCmds[cmd]
        if (!cmdFunc) return true;
        this.executeCmd(cmdFunc, client, ...args)
        await sleep(300)
      }
    }
  }

  private executeCmd(cmd: CommandInfo, client: Client | ServerClient, ...args: any[]) {
    if (cmd instanceof Function) {
      cmd.call(this.srv, client, ...args)
    } else {
      cmd.callable.call(this.srv, client, ...args)
    }
  }

  proxyCommandHandler: PacketMiddleware = async ({ meta, data, pclient }) => {
    if (this.srv.proxy == null || pclient == null) return
    if (meta.name !== 'chat') return
    const cmds: string[] = data.message.split('|')
    return await this.commandHandler(pclient, ...cmds)
  }

  unlinkedChatHandler = async (
    client: Client | ServerClient,
    data: any,
    meta: PacketMeta
  ) => {
    if (this.srv.isProxyConnected()) return
    const { message }: { message: string } = data
    return await this.commandHandler(client, ...message.split('|'))
  }



  manualRun (cmd: string, client: Client | ServerClient, ...args: any[]) {
    if (!cmd.startsWith(this.prefix)) cmd = this.prefix + cmd
    const cmdRunner = this.getActiveCmds(client);
    const cmdFunc = cmdRunner[cmd]
    if (cmdFunc) this.executeCmd(cmdFunc, client, ...args)
  }

  proxyTabCompleteListener: PacketMiddleware = async ({ meta, data, pclient }) => {
    if (this.srv.proxy == null || pclient == null) return
    if (meta.name !== 'tab_complete') return

    this.mostRecentTab.set(pclient.uuid, data.text)

    // TODO: this technically fails in 2b queue since 2b server does not respond with tab_complete.
    if (pclient !== this.srv.proxy.pclient) {
      const matches = []
      const cmds = Object.keys(this.getActiveCmds(pclient))
      for (const cmd of cmds) {
        if (cmd.startsWith(data.text)) {
          matches.push(cmd)
        }
      }
      pclient.write('tab_complete', { matches })
    }
  }

  proxyTabCompleteIntercepter: PacketMiddleware = async ({ meta, data, pclient }) => {
    if (this.srv.proxy == null || pclient == null) return
    if (meta.name !== 'tab_complete') return
    const { matches: orgMatches }: { matches: string[] } = data

    const lengths = orgMatches.map((str) => str.length)
    const maxLen = Math.max(...lengths)

    let text
    if (lengths.length !== 0) {
      let found = maxLen
      for (let i = 0; i < maxLen; i++) {
        const chrs = orgMatches.map((str) => str.charAt(i))
        if (chrs.some((chr) => chrs.some(internal => chr !== internal))) {
          found = i
          break
        }
      }
      text = orgMatches[lengths.indexOf(maxLen)].substring(0, found)
    } else {
      text = this.mostRecentTab.get(pclient.uuid)
      if (text == null) throw Error('Somehow missed a tab_complete')
    }

    const matches = []
    for (const cmd of Object.keys(this.getActiveCmds(pclient))) {
      if (cmd.startsWith(text)) {
        matches.push(cmd)
      }
    }

    data.matches = data.matches.concat(...matches)
    return data
  }

  updateClientCmds (client: Client) {
    this.srv.proxy?.attach(client as any, {
      toServerMiddleware: [...(client.toServerMiddlewares ?? []), this.proxyCommandHandler, this.proxyTabCompleteListener],
      toClientMiddleware: [...(client.toClientMiddlewares ?? []), this.proxyTabCompleteIntercepter]
    })

    client.on('chat', async (...args) => await this.unlinkedChatHandler(client, ...args) as any)
  }

  isCmd (cmd: string): boolean {
    if (!cmd.startsWith(this.prefix)) cmd = this.prefix + cmd
    const cmdRunner = this.getAllCmds();
    return !!cmdRunner.connected[cmd] || !!cmdRunner.disconnected[cmd]
  }


  printHelp = (client: ServerClient | Client) => {
    const cmdRunner = this.getActiveCmds(client)
    this.srv.message(client, '§6---------- Proxy Commands: ------------- ', false)
    for (const cmdKey in cmdRunner) {
      const cmd = cmdRunner[cmdKey]

      let toSend
      if (cmd instanceof Function) {
        toSend = `§6${cmdKey}:§r Unknown.`
      } else {
        toSend = `§6${cmdKey}:§r `
        if (cmd.description) toSend += cmd.description
        else toSend += 'Unknown.'
      }

      this.srv.message(client, toSend, false)
    }
  }

  public printUsage = (client: ServerClient | Client, wantedCmd: string) => {
    const cmdRunner = this.getActiveCmds(client);
    if (!wantedCmd) return this.srv.message(client, '[pusage] Unknown command!')
    if (wantedCmd.startsWith(this.prefix)) wantedCmd.replace(this.prefix, '')
    const cmd = cmdRunner[this.prefix + wantedCmd]
    if (cmd) {
      if (cmd instanceof Function) {
        this.srv.message(client, `Usage of ${wantedCmd} is unknown, assume no arguments!`, false)
      } else {
        if (cmd.usage == null && cmd.description == null) {
          this.srv.message(client, `Usage of ${wantedCmd} is unknown, assume no arguments!`, false)
          return
        }

        let toSend = `§6${cmd.usage ? this._prefix + cmd.usage : wantedCmd + ' (no args)'}:§r `
        if (cmd.description) toSend += cmd.description
        else toSend += 'Unknown.'

        this.srv.message(client, toSend, false)
      }
    } else {
      return this.srv.message(client, '[pusage] Unknown command!')
    }
  }
}
