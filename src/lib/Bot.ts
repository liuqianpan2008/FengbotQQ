import ws from "ws";
import { Botconfig } from "./config.js";
export class Bot extends ws {
  constructor() {
    super(`${Botconfig.protocol}://${Botconfig.host}:${Botconfig.port}`, {
      headers: {
        "Authorization": `Bearer ${Botconfig.accessToken}`
      }
    });
  }
}
