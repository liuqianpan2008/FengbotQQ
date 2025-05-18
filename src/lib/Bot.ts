import { NCWebsocket } from 'node-napcat-ts'
import {Botconfig as config} from './config.js'
import { runplugins } from './Plugins.js';

export class Bot extends NCWebsocket{
    constructor() {
        super({
            protocol: config.bot.protocol,
            host: config.bot.host,
            port: config.bot.port,
            accessToken: config.bot.accessToken,
            throwPromise: config.bot.throwPromise,
            reconnection: {
                enable: config.bot.reconnection.enable,
                attempts: config.bot.reconnection.attempts,
                delay: config.bot.reconnection.delay
            }
        });
    }

    async run(){
        try {
           await this.connect()
           runplugins()
           console.log('启动成功！')
        } catch (error) {
            console.error(error)
        }
    }
}
