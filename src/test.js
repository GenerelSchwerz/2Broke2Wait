const {loadAntiafk} = require("@nxg-org/mineflayer-antiafk")

const {createBot} = require("mineflayer");




const bot = createBot({
    host: "localhost",
    port: 25565,
    username: "hi"
})


bot.loadPlugin(loadAntiafk);