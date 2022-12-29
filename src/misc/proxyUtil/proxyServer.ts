import { createServer, ServerOptions, Server, Client, ServerClient } from "minecraft-protocol";
import merge from "ts-deepmerge";
import type { Bot } from "mineflayer"
import rob, { Conn } from "@rob9315/mcproxy";


/**
 * Function to filter out some packets that would make us disconnect otherwise.
 * Note: This is where you could filter out packets with sign data to prevent chunk bans.
 * @param data data from the server
 * @param meta metadata name of the packet
 * @param dest dunno actually.
 */
function filterPacketAndSend(data, meta, dest) {
    if (meta.name !== "keep_alive" && meta.name !== "update_time") { //keep alive packets are handled by the client we created, so if we were to forward them, the minecraft client would respond too and the server would kick us for responding twice.
        dest.writeRaw(data);
    }
}


export interface IProxyServerOpts {
    whitelist: boolean,
    antiAFK: boolean,
}

export class ProxyServer {
    public opts: IProxyServerOpts;
    public readonly server: Server;
    public readonly proxy: Conn;
    public readonly remoteBot: Bot;
    public readonly remoteClient: Client;

    private _connectedPlayer: ServerClient | null;

    public get connectedPlayer() {
        return this._connectedPlayer;
    }

    public isPlayerConnected() {
        return this._connectedPlayer !== null;
    }

    public constructor(server: Server, proxy: Conn, opts: Partial<IProxyServerOpts>) {
        this.server = server;
        this.proxy = proxy;
        this.remoteBot = proxy.stateData.bot;
        this.remoteClient = proxy.stateData.bot._client;
        this.opts = merge.default({ whitelist: true}, opts)

        // lol rough check for afk module.
        // ye not pretty but it will do
        // TODO: there's bot.hasPlugin but I wrote my own plugin so we'll test that out later
        this.opts.antiAFK = this.opts.antiAFK && !!proxy.stateData.bot["afk"] 

        server.on('login', async (actualUser) => {
            if (this.opts.whitelist && this.remoteClient.uuid !== actualUser.uuid) {
                actualUser.end(
                    "Not whitelisted!\n" +
                    "You need to use the same account as 2b2w or turn the whitelist off."
                );
                return;
            }

            actualUser.on('packet', (data, meta, rawData) => filterPacketAndSend(rawData, meta, this.remoteClient));
            actualUser.on('end', (reason) => {
                this._connectedPlayer = null;
                if (this.opts.antiAFK) {
                    this.remoteBot["afk"].start();
                }
                // startAntiAntiAFK();
            });

            if (this.opts.antiAFK) {
                await this.remoteBot["afk"].stop();
            }

            this.proxy.sendPackets(actualUser as any); // works in original?
            this.proxy.link(actualUser as any) // again works
            this._connectedPlayer = actualUser;

        })
    }



    public static createProxyServer(proxy: Conn, serverOpts: ServerOptions, proxyServerOpts?: Partial<IProxyServerOpts>): ProxyServer {
        return new ProxyServer(createServer(serverOpts), proxy, proxyServerOpts || {});
    }


    /**
     * Custom version of minecraft-protocol's server close() to give a better message.
     */
    public close(): void {
        this.remoteBot.quit();
        Object.keys(this.server.clients).forEach(clientId => {
            const client = this.server.clients[clientId]
            client.end('Proxy stopped.')
        })
        this.server["socketServer"].close()
    }
}

