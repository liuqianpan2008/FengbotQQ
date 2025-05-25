import botlogger from "../lib/logger.js";
import { ParamType } from "../interface/plugin.js";
import { param, plugins, runcod } from "../lib/decorators.js";
import { addProp, getuserProp, Props, reduceProp } from "../lib/prop.js";
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage } from "node-napcat-ts";
import { removeCoins } from "../lib/economy.js";
import path from "path";
import { fileURLToPath } from "url";
import { Prop } from "../interface/prop.js";

@plugins({
    easycmd: true,//是否启用简易命令，启用将将命令注册为<命令名称>，不启用将注册为#<插件名称> <命令名称>
    name: "道具插件", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "官方道具插件", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示道具插件" //帮助信息描述
    }
})
export class Propplu {
    @runcod(["use", "使用道具"],"使用道具" )
    async useprop(
        @param("道具Id", ParamType.String) propId: string,
        @param("QQ", ParamType.Number) userId: string,
        @param("数量", ParamType.Number, 1, true) Num: number,
        @param("道具参数",ParamType.String,"",true) propparam:string,
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const userProp = await getuserProp(context?.sender?.user_id.toString()??"0") || [];
        let findprop = userProp.find((prop) => prop.propId == propId);
        if (!findprop) {
            return this.tl(`你没有${propId}道具`,'error',`你没有${propId}道具`)
        }
        if (findprop.Num < Num) {
            return this.tl(`道具数量不足`,'error',`道具数量不足`)
        }
        Props.forEach((prop) => {
            if (prop.propId === propId) {
                if(prop.maxuse<Num){
                    return this.tl(`该道具允许最大使用数量为${prop.maxuse}超过最大使用数量`,'error',`该道具允许最大使用数量为${prop.maxuse}超过最大使用数量`)
                }
            }    
        });
        try {
            for (let i = 0; i < Num; i++) {
                let fn;
                let classConstructor;
                let propid=''
                Props.forEach((prop) => {
                    if (prop.propId==propId) {
                        fn = prop.fn;
                        classConstructor = prop.classConstructor
                        propid= prop.propId
                    }
                })
                if (await reduceProp(context?.sender?.user_id.toString()??"0", propid, 1)){
                    const result = (fn as any).call(classConstructor, userId, propparam,context);
                    if (result) {
                        return result;
                    }
                };
            }
        } catch (error: any) {
            botlogger.error(error);
            return this.tl(`道具使用失败:${error.message}`,'error',`道具使用失败:${error.message}`)
        }
        return "道具使用失败";
    }

    @runcod(["list", "道具列表"],"道具列表")
    async getprop(){
        let s ='道具列表:\n'
        let p: Prop[] =[]
        Props.forEach((prop) => {
            p.push(prop)
            s += `名称：${prop.propName}[${prop.propId}]---描述：${prop.describe}---价格：${prop.price}\n`;
        })
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        return {
            Prs:p,
            template:{
            enabled: true,
            sendText: false,
            path: path.resolve(__dirname, '..','resources', 'prop',`getprop.html`),//模版路径，推荐按规范放置在resources目录下
            render: {//浏览器默认参数设置，用于打开浏览器的设置
                width: 800, // 模板宽度
                type: 'png',// 模板类型
                quality: 100,// 模板质量
                fullPage: false,// 是否全屏
                background: true// 是否背景
            },
            
        },
        toString(){
            return s;
        }
    }
    
}

    @runcod(["my", "道具" ,"我的道具"], "我的道具")
    async userprop(context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage){
        const props = (await getuserProp(context?.sender?.user_id?.toString()??"0"));
        let p: Prop[] =[]
        let s ='道具列表:\n'
        props.forEach((prop) => {
            Props.forEach((Allprop) => {
                if(Allprop.propId === prop.propId){
                    Allprop.Num=prop.Num
                    p.push(Allprop) 
                }
            })
            s += `名称：${prop.propName}---描述：${prop.describe}---数量：${prop.Num}\n`;
        })
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        return {
                Prs:p,
                nickname:context?.sender?.nickname??"未知",
                template:{
                enabled: true,
                sendText: false,
                path: path.resolve(__dirname, '..','resources', 'prop',`userprop.html`),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 800, // 模板宽度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true// 是否背景
                },
                
            },
            toString(){
                return s;
            }
        }
    }
    @runcod(["buy","买"],"购买道具")
    async buyprop(
        @param("道具Id", ParamType.String) propId: string,
        @param("数量", ParamType.Number, 1, true) Num: number,
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        if(Num<=0){
            return this.tl('道具数量不能小于0','error','道具数量不能小于0')
        }
        let res = ''
        Props.forEach(async (prop) => {
            if(prop.propId===propId){
                removeCoins(context?.sender?.user_id?.toString(),prop?.price??0 * Num,`购买道具${prop?.propName??'未知'}`)
                addProp(context?.sender?.user_id?.toString(),prop?.propId,Num)
                res = `购买${prop.propName}成功！消费${prop.price * Num}!`
            }
        })
        return this.tl(res,'success',res)
          
    }
    tl ( msg:string, type:'success'|'error',text:string) {
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        return {
            msgtype: 'success',
            ecomsg: msg,
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
                return text;
            }
        }   
    }
}