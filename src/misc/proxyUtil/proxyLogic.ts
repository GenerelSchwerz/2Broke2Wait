import { IProxyServerOpts, ProxyServer } from "./proxyServer.js";
import mc, {ServerOptions} from "minecraft-protocol"
import { Command, ConnectMode, LoopMode, LoopModes, promisedPing, sleep } from "../constants.js";
import { Conn } from "@rob9315/mcproxy";
import merge from "ts-deepmerge";

import type {BotOptions} from "mineflayer"

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

    public constructor(bOptions: BotOptions, sOptions: ServerOptions, psOptions?: Partial<IProxyServerOpts>) {
    // const discClient = await buildClient(options.discord.token, options.discord.prefix)

        this._proxy = new Conn(bOptions)
        if (sOptions["online-mode"] !== false) {
            sOptions["online-mode"] = bOptions.auth !== "offline"
        }
        this._proxyServer = ProxyServer.createProxyServer(this._proxy, sOptions, psOptions)

    }


    public async handleCommand(command: Command, ...args: any[]): Promise<any> {
        switch (command) {
            case "shutdown":
                return this.shutdown();

            case "loop":
                return this.loop(args[0]);

            case "pingtime":
                return await this.pingTime(args[0], Number(args[1]))


            case "stats":
                return this.getStats();





            default:
                return;

        }
    }

    public shutdown(): number {
        const localPlayerCount = Object.values(this.proxyServer.server.clients).length
        this.proxyServer.close();
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



    public async reconnectWhenPingable() {
        let res = false;
        do {
            mc.ping({
                host: "",
                port: 0
            }, (err) => res = !!err)

            await sleep(3000)
        } while (!res);

    }

   
    public start() {

    }


}