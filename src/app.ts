import { Bot } from "./lib/bot.js";


async function main() {
    try{
        const bot = new Bot()
        bot.on("open", () => {
            console.log("连接成功")
        })
        bot.on("message", (msg) => {
            console.log(msg)
        })
    }
    catch(err){
        console.log(err)
    }
}
await main()