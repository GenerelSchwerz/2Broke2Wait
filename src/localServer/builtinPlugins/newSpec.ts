import { ServerClient } from "minecraft-protocol";
import { ProxyServerPlugin } from "../baseServer";





export class GhostPlugin extends ProxyServerPlugin {

    


    whileConnectedLoginHandler = async (player: ServerClient): Promise<boolean> => {

        if (!this.server.isUserWhitelisted(player)) {

            const {address, family, port} = {
                address: "UNKNOWN",
                family: "UNKNOWN",
                port: NaN,
                ...player.socket.address()
            }




        }


        return true;
        
    }



}