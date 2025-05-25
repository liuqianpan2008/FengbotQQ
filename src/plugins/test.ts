//PLUGIN test.ts

  
import { coins, param, plugins, runcod, schedule } from '../lib/decorators.js';
import path from 'path';
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { qqBot } from '../app.js';
import botlogger from '../lib/logger.js';
import { ParamType } from '../interface/plugin.js';
import { prop } from '../lib/prop.js';
import * as fs from 'fs'
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage } from 'node-napcat-ts/dist/Interfaces.js';
async function convertImageToBase64(filePath: string): Promise<string> {
    try {
      const fileData = await fs.promises.readFile(filePath);
      return `data:image/jpeg;base64,${fileData.toString('base64')}`;
    } catch (error) {
      console.error('图片转换失败:', error);
      return '';
    }
  }
@plugins({
    easycmd: true,//是否启用简易命令，启用将将命令注册为<命令名称>，不启用将注册为#<插件名称> <命令名称>
    name: "测试插件", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "测试功能", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class test {
    constructor() {
        //构造函数内可以再次注册qqBot的事件
        qqBot.on('message', async (event) => {
            event.message.forEach(async (message) => {
                if (message.type === 'text') {
                    if (message.data.text === '自测') {
                        await event.quick_action([{
                            type: 'text',
                            data: { text: `插件加载事件测试` }
                        }]);
                    }
                }
            })
        })
        botlogger.info("测试插件加载成功")
    }
    @runcod(
        ["param"], //命令名称，用于触发命令
        "参数实例" //命令描述，用于显示在默认菜单中
    )//命令装饰器，用于注册命令
    async param(
        @param("参数1", ParamType.String) param1: string,//参数装饰器，用于解析参数
        @param("参数2", ParamType.Number,999,true) param2: number,//参数装饰器，用于解析参数
    ): Promise<any> {
        if (!param1 || !param2) {
            return "请输入正确的参数格式: #test param <字符串> <数字>";//返回错误信息，用于显示在菜单中
        }
        const __dirname = path.dirname(fileURLToPath(import.meta.url)); //获取当前文件的目录名
        // 返回带模板的响应
        return {
            param1,//参数1，用于显示在菜单中
            param2,//参数2，用于显示在菜单中
            template: { // 模板配置，用于发送图片内容
                enabled: true,//是否启用模板，启用将发送图片内容
                sendText: false,//是否发送文本，启用将发送文本内容，如果都启用则发送两条消息
                path: path.resolve(__dirname, '..', 'resources', 'test', 'param.html'),//模版路径，推荐按规范放置在resources目录下
                render: {//浏览器默认参数设置，用于打开浏览器的设置
                    width: 600, // 模板宽度
                    height: 1, // 模板高度
                    type: 'png',// 模板类型
                    quality: 100,// 模板质量
                    fullPage: false,// 是否全屏
                    background: true// 是否背景
                }
            },
            toString() { //重写toString方法，用于返回文本内容，启用sendText时将发送文本内容，不启用时将发送图片内容，图片发送失败时发送文字内容
                return `参数1(字符串): ${param1}\n参数2(数字): ${param2}`;
            }
        };
    }

    @runcod(["remove"], "移除金币")//命令装饰器，用于注册命令
    @coins(
        10,//金币数量
        'remove',//类别 add为增加金币，remove为减少金币
    ) //经济修饰词，用于减少金币
    async remove(){
        return `移除成功`;
    }
    @schedule('* */30 * * * *') // 每30分钟执行一次
    async testschedule() {
        // botlogger.info("定时任务测试")
    }
    @prop(
        "testProp",//道具id
        "称号卡",//道具名称
        1,//道具最大使用数量
        "实例道具，使用后可以给指定群友设置称号，需要管理权限",//道具描述
        await convertImageToBase64("/Users/fenglin/Desktop/botQQ/src/resources/test/Prop/test.jpg"),//道具图片
        1//道具价格
    )
    async test(
        userId:string,
        propparam:string,
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any>{
        debugger
        if (context?.message_type === 'group') {
            await qqBot.set_group_special_title({
                group_id:Number(context.group_id),
                user_id:Number(userId),
                special_title:propparam
            })
        }
        return `操作成功！`
    }

}