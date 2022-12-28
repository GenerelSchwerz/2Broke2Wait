import config from "config"
// @ts-expect-error
import { buildClient } from "./discord/main.js"


const token = config.get("discord.token")

buildClient(token)


console.log(config.get("test.hi"))