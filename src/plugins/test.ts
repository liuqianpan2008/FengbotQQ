//PLUGIN test.ts

import { param, plugins, runcod, schedule } from '../lib/decorators.js';
import path from 'path';
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { qqBot } from '../app.js';
import botlogger from '../lib/logger.js';
import { ParamType } from '../interface/plugin.js';

@plugins({
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
    @runcod(["param"], "参数实例")//命令装饰器，用于注册命令
    async param(
        @param("参数1", ParamType.String) param1: string,//参数装饰器，用于解析参数
        @param("参数2", ParamType.Number) param2: number,//参数装饰器，用于解析参数
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
                    height: 300,// 模板高度
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

    @schedule('* */30 * * * *') // 每30分钟执行一次
    async testschedule() {
        // botlogger.info("定时任务测试")
    }

}