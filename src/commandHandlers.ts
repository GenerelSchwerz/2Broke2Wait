import { isAnyCommand } from "./misc/constants";
import { ProxyLogic } from "./misc/proxyUtil/proxyLogic";

export async function cliCommandHandler<T extends ProxyLogic>(
  line: string,
  logic: T
) {
  const [command, ...args] = line.split(" ");
  if (isAnyCommand(command)) {
    return await logic.handleCommand(command, ...args);
  }
}
