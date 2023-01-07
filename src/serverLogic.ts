import { IProxyServerEvents } from "./abstract/proxyServer";
import { AntiAFKOpts, AntiAFKServer } from "./impls/antiAfkServer";
import { CombinedPredictor } from "./impls/combinedPredictor";
import { Server, Client, ServerClient, PacketMeta } from "minecraft-protocol";

import { Conn } from "@rob9315/mcproxy";
import { waitUntilStartingTime } from "./util/remoteInfo";
import { PacketQueuePredictorEvents } from "./abstract/packetQueuePredictor";
import { EventEmitter2, ConstructorOptions } from "eventemitter2";
import { sleep } from "./util/index";
import { ClientEventRegister, ServerEventRegister } from "./abstract/eventRegisters";
import {StrictEventEmitter} from "strict-event-emitter-types";
import type { Bot, BotOptions } from "mineflayer"


export interface ServerLogicEvents extends PacketQueuePredictorEvents, IProxyServerEvents {
    started: () => void;
    "*": ServerLogicEvents[Exclude<keyof ServerLogicEvents, "*">]
}

export type StrictServerLogicEvents = Omit<ServerLogicEvents, "*">

type ServerLogicEmitter = StrictEventEmitter<EventEmitter2, ServerLogicEvents>;

export class ServerLogic extends (EventEmitter2 as { new(options?: ConstructorOptions): ServerLogicEmitter }) {

    public readonly event: any;
    private online: boolean;
    private _options: BotOptions;
    private _psOpts: AntiAFKOpts;
    private _conn: Conn;
    private _rawServer: Server;
    private _proxyServer: AntiAFKServer | null;
    private _queue: CombinedPredictor | null;
    private _registeredClientListeners: Set<string> = new Set();
    private _runningClientListeners: ClientEventRegister<Bot | Client, any>[] = [];

    private _registeredServerListeners: Set<string> = new Set();
    private _runningServerListeners: ServerEventRegister<any>[] = [];



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
        return this._proxyServer?.remoteBot;
    }

    public get remoteClient() {
        return this._proxyServer?.remoteClient;
    }

    public get connectedPlayer() {
        return this._proxyServer?.connectedPlayer;
    }

    public get psOpts() {
        return this._psOpts;
    }

    public get bOpts() {
        return this._options;
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
        super({ wildcard: true });
        this.online = online;
        this._options = bOptions;
        this._psOpts = psOptions;
        this._rawServer = server;
        this._proxyServer = null;
        this._queue = null;

        this.convertToDisconnected();
    }

    public isProxyConnected() {
        return this._proxyServer && this._proxyServer.isProxyConnected();
    }

    public start() {
        this.convertToConnected();

        this._conn = new Conn(this._options);
        this._queue = new CombinedPredictor(this._conn);
        this._proxyServer = AntiAFKServer.wrapServer(this.online, this._conn, this._rawServer, this._queue, this._psOpts);
        this._proxyServer.on("*" as any, (...args: any[]) => {
            this.emit(this._proxyServer["event"], ...args);
        });
        this._queue.on("*" as any, (...args: any[]) => {
            this.emit(this._queue["event"], ...args);
        });
        this.emit("started");
    }

    public async playat(hour: number, minute: number) {
        await waitUntilStartingTime(hour, minute);
        this.start();
    }

    public stop() {
        this._queue.end();
        this._proxyServer.stop();
        this.convertToDisconnected();
    }

    public shutdown() {
        this.stop();
    }

    public async restart(ms: number = 0) {
        this.stop();
        await sleep(ms);
        this.start();
    }

    public kickAll() {
        for (const client in this._rawServer.clients) {
            this._rawServer.clients[client].end("Host ran kick all.");
        }
    }

    public registerClientListeners(...listeners: ClientEventRegister<Bot | Client, any>[]) {
        for (const listener of listeners) {
            if (this._registeredClientListeners.has(listener.constructor.name)) continue;
            this._registeredClientListeners.add(listener.constructor.name);
            listener.begin();
            this._runningClientListeners.push(listener);
        }
    }

    public removeClientListeners(...listeners: ClientEventRegister<Bot | Client, any>[]) {
        for (const listener of listeners) {
            if (!this._registeredClientListeners.has(listener.constructor.name)) continue;
            this._registeredClientListeners.delete(listener.constructor.name);
            listener.end();
            this._runningClientListeners = this._runningClientListeners.filter(l => l.constructor.name !== listener.constructor.name);
        }
    }

    public removeAllClientListeners() {
        this._registeredClientListeners.clear();
        for (const listener of this._runningClientListeners) {
            listener.end();
        }
        this._runningClientListeners = [];
    }

    public registerServerListeners(...listeners: ServerEventRegister<any>[]) {
        for (const listener of listeners) {
            if (this._registeredServerListeners.has(listener.constructor.name)) continue;
            this._registeredServerListeners.add(listener.constructor.name);
            listener.begin();
            this._runningServerListeners.push(listener);
        }
    }

    public removeServerListeners(...listeners: ServerEventRegister<any>[]) {
        for (const listener of listeners) {
            console.log(listener.constructor.name)
            if (!this._registeredServerListeners.has(listener.constructor.name)) continue;
            this._registeredServerListeners.delete(listener.constructor.name);
            listener.end();
            this._runningServerListeners = this._runningServerListeners.filter(l => l.constructor.name !== listener.constructor.name);
        }
    }

    public removeAllServerListeners() {
        this._registeredServerListeners.clear();
        for (const listener of this._runningServerListeners) {
            listener.end();
        }
        this._runningServerListeners = [];
    }


    protected convertToConnected() {
        this._rawServer.on("login", this.whileConnectedCommandHandler);
        this._rawServer.off("login", this.notConnectedCommandHandler);
        this._rawServer.off("login", this.notConnectedLoginHandler);

        for (const client in this._rawServer.clients) {
            this.whileConnectedCommandHandler(this._rawServer.clients[client] as any);
        }
    }

    protected convertToDisconnected() {
        this._rawServer.on("login", this.notConnectedCommandHandler);
        this._rawServer.on("login", this.notConnectedLoginHandler);
        this._rawServer.off("login", this.whileConnectedCommandHandler);

        for (const client in this._rawServer.clients) {
            this.notConnectedCommandHandler(this._rawServer.clients[client] as any);
        }
    }


    protected notConnectedLoginHandler = (actualUser: ServerClient) => {
        actualUser.write('login', {
            entityId: actualUser.id,
            levelType: 'default',
            gameMode: 0,
            dimension: 0,
            difficulty: 2,
            maxPlayers: 1,
            reducedDebugInfo: false
        });
        actualUser.write('position', {
            x: 0,
            y: 1.62,
            z: 0,
            yaw: 0,
            pitch: 0,
            flags: 0x00
        });
    }

    /**
     * This WILL be moved later.
     * @param actualUser 
     */
    protected notConnectedCommandHandler = (actualUser: ServerClient) => {
        actualUser.on("chat", ({message}: {message: string}, packetMeta: PacketMeta) => {
            switch (message) {
                case "/start":
                    this.kickAll();
                    this.start();
                    break;
                default:
                    break;
            }
                
        })
        actualUser.on("tab_complete", (packetData: {text: string, assumeCommand: boolean, lookedAtBlock?: any}, packetMeta: PacketMeta) => {
            if ("/start".startsWith(packetData.text)) {
                actualUser.write('tab_complete', {
                    matches: ["/start"]
                })
            }
        });
    };

    /**
     * This WILL be moved later.
     * @param actualUser 
     */
    protected whileConnectedCommandHandler = (actualUser: ServerClient) => {        
        actualUser.on("chat", ({message}: {message: string}, packetMeta: PacketMeta) => {
            switch (message) {
                case "/stop":
                    this.stop();
                    break;
                default:
                    break;
            }
                
        })
        actualUser.on("tab_complete", (packetData: {text: string, assumeCommand: boolean, lookedAtBlock?: any}, packetMeta: PacketMeta) => {
            if ("/stop".startsWith(packetData.text)) {
                actualUser.write('tab_complete', {
                    matches: ["/stop"]
                })
            }
        });
    };

}