import { IProxyServerOpts, ProxyServer } from "./proxyServer.js";
import mc, { ServerOptions } from "minecraft-protocol"
import { BaseCommand, ConnectMode, LoopMode, LoopModes, promisedPing, sleep } from "../constants.js";
import { Conn } from "@rob9315/mcproxy";
import merge from "ts-deepmerge";

import type { BotOptions } from "mineflayer"

type Test = keyof ProxyLogic

export class ProxyLogic {

    private _proxy: Conn | null;
    private _pServer: ProxyServer | null;

    private _currentConnectMode: ConnectMode;
    private _currentLoopMode: LoopMode;

    private _proxyServer: ProxyServer | null;

    public get currentConnectMode() {
        return this._currentConnectMode;
    }

    public get currentLoopMode() {
        return this._currentLoopMode;
    }

    public get proxyServer() {
        return this._proxyServer;
    }

    public get proxy() {
        return this._proxy;
    }

    public get pServer() {
        return this._pServer;
    }

    private get rawServer() {
        return this._pServer.server ?? null;
    }

    public constructor(public bOptions: BotOptions, public sOptions: ServerOptions, public psOptions: Partial<IProxyServerOpts> = {}) {
        // const discClient = await buildClient(options.discord.token, options.discord.prefix)
        if (this.sOptions["online-mode"] !== false) {
            this.sOptions["online-mode"] = this.bOptions.auth !== "offline"
        }
    }


    public async handleCommand(command: BaseCommand, ...args: any[]): Promise<unknown> {
        switch (command) {
            case "shutdown":
                return this.shutdown();

            case "start":
                return this.start();
            
            case "startat":
                break;

            case "loop":
                return this.loop(args[0]);

            case "pingtime":
                return await this.pingTime(args[0], Number(args[1]))


            case "stats":
                return this.getStats();





            default:
                // should be only occurrence of returning undefined.
                return undefined;

        }
    }


    public start() {
        this._proxyServer = ProxyServer.createProxyServer(this.bOptions, this.sOptions, this.psOptions)
        this._proxy = this._proxyServer.proxy
        return true;
    }

    public shutdown(): number {
        const localPlayerCount = Object.values(this.proxyServer.server.clients).length
        this.proxyServer.close();
        this._proxyServer = null;
        this._proxy = null;
        return localPlayerCount;
    }


    public loop(mode: LoopMode | "status"): boolean {
        if (LoopModes.includes(mode as any)) {
            let loopChanged = this._currentLoopMode === mode;
            this._currentLoopMode = mode as LoopMode;
            return loopChanged;

            // unnecessary check.
        } else if (mode === "status") {
            return this._currentLoopMode !== "disabled"
        }
    }

    public async pingTime(host: string, port: number): Promise<number> {
        let pingStart = performance.now();
        try {
            await promisedPing({ host, port });
        } catch (e) {
            return Number.NaN;
        }
        return performance.now() - pingStart;
    }


    public getStats() {
        return {
            health: this.proxyServer.remoteBot.health,
            food: this.proxyServer.remoteBot.food,
        }
    }



    public async reconnectWhenPingable(host: string, port: number) {
        let res = false;

        while (true) {
            try {
                await promisedPing({ host, port })
            } catch (e) {

            }
            
        }
        do {
            mc.ping({ host, port }, (err) => res = !!err)
            await sleep(3000)
        } while (!res);

    }




}