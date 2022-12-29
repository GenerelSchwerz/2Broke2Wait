import EventEmitter from "events";
import { BaseCommand, BaseCommands, QueueCommand } from "./constants.js";
import { ProxyLogic } from "./proxyUtil/proxyLogic.js";
import { ProxyServer } from "./proxyUtil/proxyServer.js";



function isBaseCommand(command: string): command is BaseCommand {
    return BaseCommands.includes(command as any);
}


export class QueueHandler extends ProxyLogic {

    private _queuePos: number = NaN;

    public get queuePos() {
        return this._queuePos;
    }





    public async handleCommand(command: QueueCommand | BaseCommand, ...args: any[]) {
        if (isBaseCommand(command)) {
            return super.handleCommand(command, ...args);
        }
        
        switch (command) {

        }

    }





}