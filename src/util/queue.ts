// =======
// Imports
// =======

import { Conn } from "@rob9315/mcproxy";
import * as notifier from "./notifier"
import type {PacketMeta, Server} from "minecraft-protocol";

// ===========
// Global Vars
// ===========

let sentNotification = false;

export let status = { // Stores pertinent information (to-do: set up setters and getters)
	"position": "CHECKING...",
	"eta": "CHECKING...",
	"restart": "None",
	"mineflayer": "CHECKING...",
	"inQueue": true,
	"ngrokUrl": "None",
	"livechatRelay": "false",
	"controller": "None"
};

function updateStatus<T extends keyof typeof status>(type: T, input: typeof status[T]) {
	if (status[type].toString() !== input.toString()) {
		status[type] = input
        console.log(status)
		return true;
	}
    console.log("status unchanged!", status.position, status.eta)
	return false;
}

// =========
// Functions
// =========

/**
 * Difficulty packet handler, checks whether or not we're in queue (explanation: when rerouted by Velocity, the difficulty packet is always sent after the MC|Brand packet.)
 */
export function difficultyPacketHandler(packetData, conn: Conn) {
	const inQueue = ((conn.stateData.bot.game as any).serverBrand === "2b2t (Velocity)") && (conn.stateData.bot.game.dimension === "minecraft:end" as any) && (packetData.difficulty === 1);
	if (updateStatus("inQueue", inQueue) && inQueue === false) { // Send notification when joining server
		notifier.sendToast("In Server!");
		notifier.sendWebhook({
			title: "In Server!",
			description: "Current IP: `" + status.ngrokUrl + "`",
			ping: true,
			category: "status",
			deleteOnRestart: true
		});
	}
}



/**
 * Playerlist packet handler, checks position in queue
 */
export function playerlistHeaderPacketHandler(packetData: any, localServer: Server) {
	// If no longer in queue, stop here
	if (status.inQueue === false) {
		updateStatus("position", "In Server!");
		updateStatus("eta", "Now!");
		return;
	}
	// Parse header packets
	const header = JSON.parse(packetData.header).extra;
	if (header && header.length === 6) {				
        console.log(JSON.stringify(header))
		const position = header[4].extra[0].text.replace(/\n/, "");
		const eta = header[5].extra[0].text.replace(/\n/, "");
		// Update position
		if (updateStatus("position", position)) {
			// Update local server motd
			localServer.motd = "Position: " + status.position + " - ETA: " + status.eta;
			if (true) { // Position notifications on Discord (status webhook)
				notifier.sendToast("2B2T Queue Position: " + status.position);
				notifier.sendWebhook({
					title: "2B2T Queue Position: " + status.position,
					description: "ETA: " + status.eta,
					category: "spam"
				});
				if (!sentNotification) {
					notifier.sendWebhook({
						title: "Position " + status.position + " in queue!",
						description: "Current IP: `" + status.ngrokUrl + "`",
						ping: true,
						category: "status",
						deleteOnRestart: true
					});
				}
				sentNotification = true;
			} else { // Position notifications on Discord (spam webhook)
				notifier.sendWebhook({
					title: "2B2T Queue Position: " + status.position,
					description: "ETA: " + status.eta,
					category: "spam"
				});
			}
		}
		// Update ETA
		updateStatus("eta", eta);
	}
}

