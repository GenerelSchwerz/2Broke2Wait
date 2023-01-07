import { ProxyServer } from "../abstract/proxyServer";
import { ServerLogic } from "../serverLogic";
import { Options } from "./options";



let sendToWebhook = (...any: any[]) => {};



export function setFunctions(srv: ServerLogic, config: Options["discord"]["webhooks"]) {
    if (!config.enabled) return;

    if (!!config.spam) {
        // sendToWebhook = ()
    }
}