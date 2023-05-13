const { ProxyServerPlugin } = require("@nxg-org/mineflayer-mitm-proxy");
const fs = require("fs");
const detectTSNode = require("detect-ts-node");

/**
 * Gen here again.
 *
 * Example plugin to go from point A to point B.
 *
 * I will include this plugin in the main project as a POC.
 *
 * Note: this does not leverage the spectator setting present in most of the proxy.
 *  That is because that is a separate plugin. That is intentional.
 *  This is purposefully simple so it can be easy to follow.
 *
 */
class HotLoaderPlugin extends ProxyServerPlugin {
  universalCmds = {
    reloadPlugins: {
      description: "reload plugins in plugin folder",
      callable: this.reloadPluginFolder.bind(this),
    },
  };

  async reloadPluginFolder(client) {
    if (this.psOpts.pluginFolder == null) {
      return this.server.message(client, `Plugin folder is missing!`);
    }
    const dir = this.psOpts.pluginFolder;

    if (!fs.existsSync(dir)) {
      return this.server.message(client, `Plugin folder does not exist!`);
    }
    await Promise.all(
      fs.readdirSync(f).map(async (file) => {
        const file1 = path.join(f, file);
        const filetype = file1.split(".")[file1.split(".").length - 1];
        if (!["js", "ts"].includes(filetype)) return;
        const isTs = filetype === "ts";
        if (isTs && !detectTSNode)
            throw Error(
            "Typescript plugin loaded at runtime when running with JavaScript!\n" +
                'To load typescript plugins, run this program with "npm run ts-start"'
            ); 
        const data = await require(file1);
        if (this.server.hasPlugin(data)) this.server.unloadPlugin(data);
        this.server.loadPlugin(isTs ? data.default : data);
      })
    );
  }
}

module.exports = new RespawnPlugin();
