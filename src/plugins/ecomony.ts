import { addCoins, getUserData, removeCoins } from "../lib/economy.js";
import { param, plugins, runcod } from "../lib/decorators.js";
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage } from "node-napcat-ts/dist/Interfaces.js";
import path from "path";
import { fileURLToPath } from "url";
import { IsAdmin, Permission } from "../lib/Permission.js";
import { Receive } from "node-napcat-ts";

@plugins({
    name: "经济系统", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "官方经济插件", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class ecomony {
    @runcod(["info","个人信息"], "获取个人金币信息")
    async ecomonyInfo(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const userData = await getUserData(context?.sender?.user_id?.toString());
        const economy = userData?.economy ;
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        return {
            nickname: context?.sender?.nickname??"未知",
            coins: economy?.coins??0,
            logs: economy?.logs??[],
            avatar: `http://q1.qlogo.cn/g?b=qq&nk=${context?.sender?.user_id??0}&s=640`,
            template: {
                enabled: true,
                sendText: false,
                path: path.resolve(__dirname, '..', 'resources', 'ecomony', 'info.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 800, // 模板宽度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true// 是否背景
                }
            },
            toString() { //重写toString方法，用于返回文本内容，启用sendText时将发送文本内容，不启用时将发送图片内容，图片发送失败时发送文字内容
                let logsString = "";
                economy?.logs.forEach((log: { type: any; amount: any; reason: any; date: any; }) => {
                    logsString += `类型: ${log.type} 数量: ${log.amount} 原因: ${log.reason} 时间: ${log.date}\n`;
                });
                return `
                    金币: ${economy?.coins??0}\n
                    ------明细记录----
                    ${logsString}
                `;
            }   
        }
    }

    @Permission("Admin")
    @runcod(["add", "增加"], "增加金币")
    async addecomony(
        @param("QQ号", 'at',) userid: Receive["at"],
        @param("数量", 'text') amount: Receive["text"],
        @param("原因", 'text',{type:'text',data:{text:"管理员增加"}},true) reason: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        try {
            if (!IsAdmin(context.sender.user_id)) {
                return {
                    msgtype: 'error',
                    ecomsg: `无权限，无法增加金币`,
                    template: {
                        enabled: true,
                        sendText: false,
                        path: path.resolve(__dirname, '..','resources', 'ecomony','msg.html'),//模版路径，推荐按规范放置在resources目录下
                        render: {//浏览器默认参数设置，用于打开浏览器的设置
                            width: 800, // 模板宽度
                            height: 600,// 模板高度
                            type: 'png',// 模板类型
                            quality: 100,// 模板质量
                            fullPage: false,// 是否全屏
                            background: true// 是否背景
                        }
                    }
                }
            }
            addCoins(context.sender.user_id.toString(),Number(amount.data.text),reason.data.text)
            const newcoins = (await getUserData(userid.data.qq))?.economy?.coins??0
            return {
                msgtype: 'success',
                ecomsg: `增加成功! 金币 +${amount}, 当前数量: ${newcoins}`,
                template: {
                    enabled: true,
                    sendText: false,
                    path: path.resolve(__dirname, '..', 'resources', 'ecomony', 'msg.html'),//模版路径，推荐按规范放置在resources目录下
                    render: {//浏览器默认参数设置，用于打开浏览器的设置
                        width: 800, // 模板宽度
                        type: 'png',// 模板类型
                        quality: 100,// 模板质量
                        fullPage: false,// 是否全屏
                        background: true// 是否背景
                    }
                },
                toString() { //重写toString方法，用于返回文本内容，启用sendText时将发送文本内容，不启用时将发送图片内容，图片发送失败时发送文字内容
                    return `
                        增加成功\n
                        数量: ${amount}\n
                        原因: ${reason}\n
                        时间: ${new Date().toLocaleString()}\n
                    `;
                }   
            }
        } catch (error) {
            return {
                type: 'error',
                ecomsg: `增加失败! 原因: ${(error as Error).message??'未知错误'}`,
                template: {
                    enabled: true,
                    sendText: false,
                    path: path.resolve(__dirname, '..', 'resources', 'ecomony', 'msg.html'),//模版路径，推荐按规范放置在resources目录下
                    render: {//浏览器默认参数设置，用于打开浏览器的设置
                        width: 800, // 模板宽度
                        type: 'png',// 模板类型
                        quality: 100,// 模板质量
                        fullPage: false,// 是否全屏
                        background: true// 是否背景
                    }
                },
                toString() { //重写toString方法，用于返回文本内容，启用sendText时将发送文本内容，不启用时将发送图片内容，图片发送失败时发送文字内容
                    return `
                        增加成功\n
                        数量: ${amount}\n
                        原因: ${reason}\n
                        时间: ${new Date().toLocaleString()}\n
                    `;
                }   
            }
        }
        
    }
    
    @Permission("Admin")
    @runcod(["reduce", "减少"], "减少金币")
    async reduceecomony(
        @param("QQ号", 'at',) userid: Receive["at"],
        @param("数量", 'text') amount: Receive["text"],
        @param("原因", 'text',{type:'text',data:{text:"管理员增加"}},true) reason: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        try {
            if (!IsAdmin(context.sender.user_id)) {
                return {
                    msgtype: 'error',
                    ecomsg: `无权限，无法减少金币`,
                    template: {
                        enabled: true,
                        sendText: false,
                        path: path.resolve(__dirname, '..','resources', 'ecomony','msg.html'),//模版路径，推荐按规范放置在resources目录下
                        render: {//浏览器默认参数设置，用于打开浏览器的设置
                            width: 800, // 模板宽度
                            height: 400,// 模板高度
                            type: 'png',// 模板类型
                            quality: 100,// 模板质量
                            fullPage: false,// 是否全屏
                            background: true// 是否背景
                        }
                    }
                }
            }
            removeCoins(context.sender.user_id.toString(),-amount,reason.data.text)
            const newcoins = getUserData(userid.data.qq)?.economy?.coins??0
            return {
                msgtype:'success',
                ecomsg: `减少成功! 金币 -${amount}, 当前数量: ${newcoins}`,
                template: {
                    enabled: true,
                    sendText: false,
                    path: path.resolve(__dirname, '..','resources', 'ecomony','msg.html'),//模版路径，推荐按规范放置在resources目录下
                    render: {//浏览器默认参数设置，用于打开浏览器的设置
                        width: 800, // 模板宽度
                        height: 400,// 模板高度
                        type: 'png',// 模板类型
                        quality: 100,// 模板质量
                        fullPage: false,// 是否全屏
                        background: true// 是否背景
                    }
                }
            }
        } 
        catch (error) {
            return {
                msgtype: 'error',
                ecomsg: `减少失败! 原因: ${(error as Error).message??'未知错误'}`,
                template: {
                    enabled: true,
                    sendText: false,
                    path: path.resolve(__dirname, '..','resources', 'ecomony','msg.html'),//模版路径，推荐按规范放置在resources目录下
                    render: {//浏览器默认参数设置，用于打开浏览器的设置
                        width: 800, // 模板宽度
                        height: 400,// 模板高度
                        type: 'png',// 模板类型
                        quality: 100,// 模板质量
                        fullPage: false,// 是否全屏
                        background: true// 是否背景
                    }
                }
            }
        }
    }
}