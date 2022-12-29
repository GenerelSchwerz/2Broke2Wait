import config from "config"
import { buildClient } from "./discord/index.js"

const token = config.get("discord.token")

const discClient = await buildClient(token, "!")

