import * as fs from "fs";
import path from "path";
import merge from "ts-deepmerge";


(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

type LogCategories =
  | "remoteBotSend"
  | "remoteBotReceive"
  | "localServerSend"
  | "localServerReceive"
  | "localServerInfo";

export type LogConfig = {
  saveRootDir: string;
  cutoffSize: number;
  alwaysIncrement: boolean;
  active: {
    [key in LogCategories]?: boolean;
  };
  filters?: {
    [key in LogCategories]?: {
      blacklist?: string[];
      whitelist?: string[];
    };
  };
};
type ExtraLogInfo = {
  shiftToFront?: boolean;
};

const DefaultLogConfig: LogConfig = {
  saveRootDir: "./logs",
  cutoffSize: 1024,
  alwaysIncrement: false,
  active: {
    localServerReceive: true,
    localServerSend: true,
    localServerInfo: true,
    remoteBotReceive: true,
    remoteBotSend: true,
  },
  filters: {
    localServerSend: {
      blacklist: ["map*"],
    },
    remoteBotReceive: {
      blacklist: ["map*"],
    }
  },
};

const categories: LogCategories[] = ["remoteBotSend", "remoteBotReceive", "localServerSend", "localServerReceive"];

export class Logger {
  private logFileMap: Record<LogCategories, string>;

  public config: LogConfig;

  public enabled = false;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = merge(DefaultLogConfig, config) as any;

    if (!fs.existsSync(this.config.saveRootDir)) fs.mkdirSync(this.config.saveRootDir, { recursive: true });

    this.logFileMap = {} as any;
    for (const c of categories) {
      const catDir = path.join(this.config.saveRootDir, c, "/");
      if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
      const files = fs.readdirSync(catDir, { withFileTypes: true }).filter((f) => f.name.endsWith(`.log`));
      let file = this.findExisting(catDir, c, files);
      if (!file || this.config.alwaysIncrement) file = this.createFilename(c, files.length + 1);
      this.logFileMap[c] = path.join(catDir, file);
      
    }
  }

  public enable() {
    this.enabled = true;
  }

  public disable() {
    this.enabled = false;
  }

  /**
   * Returns a filename of the most recent and valid log to continue using.
   * @param {string} dir Directory of log folder
   * @param {string} category Category of the log to look for
   * @param {Array} files All valid files in the directory
   * @returns {string} Filename of the most recent and valid log to continue writing to (returns false otherwise)
   */
  findExisting(dir: string, category: LogCategories, files: fs.Dirent[]): string | null {
    for (let i = files.length - 1; i >= 0; i--) {
      const file = files[i].name;
      // Check if there's an existing log file to reuse and whether it has enough space to write to
      if (
        file === this.createFilename(category, files.length) &&
        fs.existsSync(dir) &&
        fs.statSync(dir + file).size < this.config.cutoffSize * 1024
      ) {
        return file;
      }
    }
    return null;
  }

  /**
   * Return a filename for a log category.
   * @param {string} category The category of the log file
   * @param {number} index The index of the log file
   * @returns {string} The created filename
   */
  public createFilename(category: LogCategories, index: number): string {
    let filename = `${category}_${index}.log`;
    return filename;
  }

  public log = (name: string, category: LogCategories, data: any, extra?: ExtraLogInfo) => {
    if (!this.enabled) return;
    if (!this.config.active[category]) return;

    if (this.config.filters != null) {
      let whiteListPassed = false;
      if (this.config.filters[category]?.whitelist != null) {
        for (const item of this.config.filters[category]!.whitelist!) {
          if (name === item || name.startsWith(item.split("*")[0])) {
            whiteListPassed = true;
            break;
          }
        }

        if (!whiteListPassed) return;
      }

      if (this.config.filters[category]?.blacklist != null) {
        for (const item of this.config.filters[category]!.blacklist!) {
          if (name === item || name.startsWith(item.split("*")[0])) return;
        }
      }
    }

    const logFile = this.logFileMap[category];

    const logMessage = `[${getTimestamp()}] [${name}] ${JSON.stringify(data)}\n`;

    let stream = fs.createWriteStream(logFile, { flags: "a" });
    stream.write(logMessage); // Save raw
    stream.end();
  }
}

/**
 * Get current timestamp
 * @param {boolean} includeTime Whether to include the Date String
 * @returns {string} Human-readable timestamp
 */
function getTimestamp(includeTime?: boolean): string {
  let timestamp: Date | string = new Date();
  if (includeTime) {
    timestamp = timestamp.toLocaleDateString();
  } else {
    timestamp = timestamp.toLocaleString();
  }
  return timestamp
    .replace(/\//g, "-") // Replace forward-slash with hyphen
    .replace(",", ""); // Remove comma
}
