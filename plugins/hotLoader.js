const { ProxyServerPlugin } = require("@nxg-org/mineflayer-mitm-proxy");
const fs = require("fs");
const path = require("path");
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
    pluginLoader: {
      reloadAll: {
        description: "reload plugins in plugin folder",
        callable: this.reloadPluginFolder.bind(this),
      },

      load: {
        usage: "[file] [dir:?]",
        description: "load plugin",
        callable: this.handleFileCmd.bind(this, true),
      },

      unload: {
        usage: "[file] [dir:?]",
        description: "unload plugin",
        callable: this.handleFileCmd.bind(this, false),
      },
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
    const results = await Promise.all(
      fs.readdirSync(dir).map(async (file) => {
        const res = await this.handleFile(this.normalizeDir(file, dir), true)
        if (res) this.server.message(client, `loaded ${file}.`);
        else this.server.message(client, `failed to load ${file}!`);
        return res;
      })
    );
    if (results.some((v) => !v)) this.server.message(client, `One or more plugins failed to load!`);
    else this.server.message(client, `All plugins successfully loaded!`);
  }

  normalizeDir(filename, dirname) {
    let f;
    if (dirname == null) dirname = this.psOpts.pluginFolder
    if (dirname != null)
      if (dirname.startsWith(".")) f = path.join(process.cwd(), dirname, filename);
      else f = path.join(dirname, filename);
    else f = path.join(process.cwd(), filename);
    return f;
  }

  async handleFileCmd(load, client, filename, dirname) {
    if (dirname != null && !fs.existsSync(dirname))
      return this.server.message(client, `Specified directory does not exist!`);

    if (filename == null)
        return this.server.message(client, `No file was specified!`);

    const f = this.normalizeDir(filename, dirname);

    if (!fs.existsSync(f))
      return this.server.message(client, `File "${filename}" at path "${dirname}" was not found!`);

    const res = await this.handleFile(f, load);
    if (res && load) this.server.message(client, `Loaded file successfully!`);
    else if (res && !load) this.server.message(client, `Unloaded file successfully!`);
    else this.server.message(client, `Failed to load file.`);
  }

  async handleFile(file, load) {
    const filetype = file.split(".")[file.split(".").length - 1];
    if (!["js", "ts"].includes(filetype)) return false;
    const isTs = filetype === "ts";
    if (isTs && !detectTSNode)
      throw Error(
        "Typescript plugin loaded at runtime when running with JavaScript!\n" +
          'To load typescript plugins, run this program with "npm run ts-start"'
      );
    const data = await require(file);
    if (this.server.hasPlugin(data)) this.server.unloadPlugin(data);
    if (load) this.server.loadPlugin(isTs ? data.default : data);
    return true;
  }
}

module.exports = new HotLoaderPlugin();
