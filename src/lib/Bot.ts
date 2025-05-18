import { NCWebsocket } from 'node-napcat-ts'
import {Botconfig as config, load, saveConfig} from './config.js'
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
    async reload(){
        let isload = await load
        if(isload.isuplad){
         isload.isuplad=false;
         if (isload.isGroupMessage) {
            this.send_group_msg({
             group_id: Number(isload.id),
             message:[{
                 type:"text",
                 data:{
                     text:  `加载插件 ${isload.name} 成功`
                 }
             }]
            }) 
         }else{
             this.send_private_msg({
                 user_id:Number(isload.id),
                 message:[{
                     type:"text",
                     data:{
                         text:`加载插件 ${isload.name} 成功`
                     }
                 }]
             })
         }
         saveConfig("load", isload)
        }
    }
    async run(){
        try {
           await this.connect()
           await runplugins()
           await this.reload()
           console.log('启动成功！')
        } catch (error) {
            console.error(error)
        }
    }
}
