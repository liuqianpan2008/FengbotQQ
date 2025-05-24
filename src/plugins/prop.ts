import botlogger from "../lib/logger.js";
import { ParamType } from "../interface/plugin.js";
import { param, plugins, runcod } from "../lib/decorators.js";
import { addProp, getuserProp, Props, reduceProp } from "../lib/prop.js";
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage } from "node-napcat-ts";
import { removeCoins } from "../lib/economy.js";

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
export class Prop {
    @runcod(["use", "使用道具"],"使用道具" )
    async useprop(
        @param("道具名称", ParamType.String) propName: string,
        @param("QQ", ParamType.Number) userId: string,
        @param("数量", ParamType.Number, 1, true) Num: number,
        @param("道具参数",ParamType.String,"",true) propparam:string,
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const userProp = await getuserProp(context?.sender?.user_id.toString()??"0") || [];
        let findprop = userProp.find((prop) => prop.propName == propName);
        if (!findprop) {
            return `你没有${propName}道具`;
        }
        if (findprop.Num < Num) {
            return "道具数量不足";
        }
        Props.forEach((prop) => {
            if (prop.propName === propName) {
                if(prop.maxuse<Num){
                   throw new Error(`该道具允许最大使用数量为${prop.maxuse}超过最大使用数量`) 
                }
            }    
        });
        try {
            for (let i = 0; i < Num; i++) {
                let fn;
                let classConstructor;
                let propid=''
                Props.forEach((prop) => {
                    if (prop.propName==propName) {
                        fn = prop.fn;
                        classConstructor = prop.classConstructor
                        propid= prop.propId
                    }
                })
                if (await reduceProp(context?.sender?.user_id.toString()??"0", propid, 1)){
                    const result = (fn as any).call(classConstructor, userId, propparam);
                    if (result) {
                        return result;
                    }
                };
            }
        } catch (error: any) {
            botlogger.error(error);
            return `道具使用失败:${error.message}`;
        }
        return "道具使用失败";
    }

    @runcod(["list", "道具列表"],"道具列表")
    async getprop(){
        let s ='道具列表:\n'
        Props.forEach((prop) => {
            s += `名称：${prop.propName}---描述：${prop.describe}---价格：${prop.price}\n`;
        })
        return s;
    }

    @runcod(["my", "道具" ,"我的道具"], "我的道具")
    async userprop(context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage){
        const props = (await getuserProp(context?.sender?.user_id?.toString()??"0"));
        let s ='道具列表:\n'
        props.forEach((prop) => {
            s += `名称：${prop.propName}---描述：${prop.describe}---数量：${prop.Num}\n`;
        })
        return s;
    }
    @runcod(["buy","买"],"购买道具")
    async buyprop(
        @param("道具名称", ParamType.String) propName: string,
        @param("数量", ParamType.Number, 1, true) Num: number,
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ){
        if(Num<=0){
            return('道具数量不能小于0')
        }
        let res = ''
        Props.forEach(async (prop) => {
            if(prop.propName===propName){
                removeCoins(context?.sender?.user_id?.toString(),prop?.price??0 * Num,`购买道具${prop?.propName??'未知'}`)
                addProp(context?.sender?.user_id?.toString(),prop?.propId,Num)
                res = `购买${prop.propName}成功！消费${prop.price * Num}!`
            }
        })
        return res ;
    }
}