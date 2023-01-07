import { IProxyServerEvents, IProxyServerOpts, ProxyServer } from "./abstract/proxyServer";
import { AntiAFKOpts, AntiAFKServer } from "./impls/antiAfkServer";
import { CombinedPredictor } from "./impls/combinedPredictor";
import { Server, Client} from "minecraft-protocol";
import type {Bot, BotOptions} from "mineflayer"
import { Conn } from "@rob9315/mcproxy";
import { waitUntilStartingTime } from "./util/remoteInfo";
import { PacketQueuePredictor, PacketQueuePredictorEvents } from "./abstract/packetQueuePredictor";
import {EventEmitter2} from "eventemitter2";
import StrictEventEmitter from "strict-event-emitter-types/types/src/index";
import { sleep } from "./util/index";
import { EventRegister } from "./abstract/EventRegister";


interface ServerLogicEvents extends PacketQueuePredictorEvents, IProxyServerEvents  {}


type ServerLogicEmitter = StrictEventEmitter<EventEmitter2, ServerLogicEvents>;

export class ServerLogic extends ( EventEmitter2 as { new(): ServerLogicEmitter }) {

    private online: boolean;
    private _options: BotOptions;
    private _psOpts: AntiAFKOpts;
    private _conn: Conn;
    private _rawServer: Server;
    private _proxyServer: AntiAFKServer | null;
    private _queue: CombinedPredictor | null;

    public get queue() {
        return this._queue;
    }

    public get rawServer() {
        return this._rawServer;
    }

    public get proxyServer() {
        return this._proxyServer;
    }

    public get remoteBot() {
        return this._proxyServer.remoteBot;
    }

    public get remoteClient() {
        return this._proxyServer.remoteClient;
    }

    public get psOpts() {
        return this._psOpts;
    }

    public set psOpts(opts: AntiAFKOpts) {
        this._psOpts = opts;
        this._proxyServer.opts = opts;
    }

    constructor(
        online: boolean,
        server: Server,
        bOptions: BotOptions,
        psOptions: AntiAFKOpts
    ) {
        super();
        this.online = online;
        this._options = bOptions;
        this._psOpts = psOptions;
        this._rawServer = server;
        this._proxyServer = null;
        this._queue = null;
    }
    
    public isProxyConnected() {
        return this._proxyServer && this._proxyServer.isProxyConnected();
    }

    public start() {
        this._conn = new Conn(this._options);
        this._queue = new CombinedPredictor(this._conn);
        this._proxyServer = AntiAFKServer.wrapServer(this.online, this._conn, this._rawServer, this._queue, this._psOpts);
        this._proxyServer.on("*" as any, (...args: any[]) => {
            this.emit((this._proxyServer as any).event, ...args);
        });
        this._queue.on("*" as any, (...args: any[]) => {
            this.emit((this._queue as any).event, ...args);
        });
    }

    public async playat(hour: number, minute: number) {
        await waitUntilStartingTime(hour, minute);
        this.start();
    }

    public stop() {
        this._proxyServer.stop();
        this._queue.end();
        this._proxyServer.once("decidedClose", () => {
            this._proxyServer = null;
            this._queue = null;
        })
     
    }

    public shutdown() {
        this.stop();
    }

    public async restart(ms: number = 0) {
        this.stop();
        await sleep(ms);
        this.start();
    }

    // public registerListeners<L extends string, T extends (emitter: Bot | Client, listener: L) => EventRegister<Bot | Client, L>>(...listeners: T[]) {
    //     for (const listener of listeners) {
    //         if (this._registeredListeners.has(listener.name)) continue;
    //         this._registeredListeners.add(listener.name);
            
    //     }
    // }

}