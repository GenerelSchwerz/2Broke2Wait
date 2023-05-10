import { Client, ServerClient } from "minecraft-protocol";
import { IProxyServerOpts, ProxyServerPlugin } from "@nxg-org/mineflayer-mitm-proxy";

export interface SecurityOpts {
  kickMessage?: string;
  whitelist: string[] | ((user: string) => boolean) | null;
}

export interface RestartOpts {
  restartOnDisconnect: boolean;
  reconnectInterval: number;
}

export interface SecurityEvents {
  unauthorizedConnection: (client: ServerClient, reason?: string) => void;
}

export class RestartPlugin extends ProxyServerPlugin<RestartOpts, {}> {
  onRemoteDisconnect(reason: string, info: string | Error) {
    if (this.psOpts.disconnectAllOnEnd) {
      // parse out text content, otherwise raw.
      try {
        info = JSON.parse(info as any).text;
      } catch (e) {}
      this.server.closeConnections("Kicked from server.", true, String(info));
    } else {
      this.server.broadcastMessage("[WARNING] Bot has disconnected!");
      this.server.broadcastMessage("You are still connected.");
    }

    if (this.psOpts.restartOnDisconnect && reason != "END") {
      this.server.restart(this.psOpts.reconnectInterval);
    }
  };
}

export class SecurityPlugin extends ProxyServerPlugin<SecurityOpts, {}, SecurityEvents> {
  
  onPlayerConnected(actualUser: ServerClient, remoteConnected: boolean) {
    if (!this.isUserWhitelisted(actualUser)) {
      this.serverEmit("unauthorizedConnection", actualUser);
      actualUser.end(this.psOpts.kickMessage ?? "You are not in the whitelist");
      return true;
    }

    if (this.server.isProxyConnected()) {
      const allowedToControl = this.server.lsOpts["online-mode"]
        ? this.server.remoteClient?.uuid === actualUser.uuid
        : this.server.remoteClient?.username === actualUser.username;

      if (!allowedToControl) {
        this.serverEmit("unauthorizedConnection", actualUser);
        actualUser.end("This user is not allowed to control the bot!");
        return true;
      }
    }
    return true;
  };

  public isUserWhitelisted(user: Client) {
    if (this.psOpts.whitelist == null) return true;
    if (this.psOpts.whitelist instanceof Array) {
      return this.psOpts.whitelist.find((n) => n.toLowerCase() === user.username.toLowerCase()) !== undefined;
    } else if (typeof this.psOpts.whitelist === "function") {
      try {
        return !!this.psOpts.whitelist(user.username);
      } catch (e) {
        console.warn("allowlist callback had error", e);
        return false;
      }
    }
    return false;
  };
}
