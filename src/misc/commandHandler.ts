import merge from "ts-deepmerge";
import { ProxyServer } from "./proxyUtil/proxyServer.js";
import * as rl from "readline";
import { buildClient } from "./discord/index.js";
import { Client } from "discordx";
import EventEmitter from "events";
import { ProxyLogic } from "./proxyUtil/proxyLogic.js";
import { Command, Commands, LoopModes } from "./constants.js";


export interface IHandlerOpts {
    cli: boolean,
    discord: boolean,
}


/**
 * TODO: make a standardized mapping for all wanted functions.
 * Then add them to discord bot easily via discordx's decorators.
 * Could work.
 */
export class CommandHandler extends EventEmitter {
    private _useDiscord: boolean;
    private cliInterface: rl.Interface | null;
    private discordClient: Client | null;


    constructor(public readonly proxyLogic: ProxyLogic, opts?: Partial<IHandlerOpts>, dClient?: Client) {
        super();
        this.useCli = opts?.cli || false;
        this._useDiscord = opts?.discord || false && !!dClient;
        this.discordClient = dClient || null;
    }

    public set useCli(use: boolean) {
        if (use) {
            this.cliInterface = rl.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            this.cliInterface.on('line', async (line) => {
                const [command, ...args] = line.split(' ');
                if (Commands.includes(command as any)) {
                    console.log(await this.proxyLogic.handleCommand(command as Command, ...args));
                    this.emit('command', 'readline', command)
                }
            })
        } else {
            this.cliInterface.close();
            this.cliInterface = null;
        }
    }



}
