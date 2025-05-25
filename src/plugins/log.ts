import { param, plugins, runcod } from '../lib/decorators.js';
import path from 'path';
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage, Receive } from 'node-napcat-ts';
import botlogger from '../lib/logger.js';
import fs from 'fs/promises';
import { qqBot } from '../app.js';
@plugins({
    name: "log日志管理", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "获取服务器机器人到log日志", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class Botlog {

    @runcod(["logs", "日志"], "获取日志")
    async logs() {
        // pluName += ".ts"
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', '..','logs');
        try {
            const files = await fs.readdir(pluginsDir);
            const foundFiles = files.filter(file =>
                (file.endsWith('.log'))
            );
            foundFiles.forEach((file, index) => {
                foundFiles[index] = path.parse(file).name;
            })
            return `找到插件文件：${foundFiles.join(', ')}`;
        } catch (error:any) {
            botlogger.error('文件查找失败：' + error.message);
            return '插件查找服务暂不可用';
        }
    }

    @runcod(["downloadlog", "getlog"], "下载日志")
    async getBotlogbyfile(
        @param("日志名称", 'text') logName: Receive["text"],
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        // pluName += ".ts"
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', '..','logs');
        try {
            const files = await fs.readdir(pluginsDir);
            const foundFiles = files.filter(file =>
                (file.endsWith('.log'))
            );

            // 根据文件名查找具体插件
            const targetFile = foundFiles.find((file: string) =>
                path.parse(file).name.toLowerCase() === logName.data.text.toLowerCase()
            );

            if (!targetFile) {
                return `未找到名为 ${logName} 的日志`;
            }

            // 返回文件完整路径
            const fullPath = path.join(pluginsDir, targetFile);
            //.toString('base64'

            const file = Buffer.from(await fs.readFile(fullPath, { encoding: "utf-8" })).toString('base64')
            const isGroupMessage = context.message_type === 'group';
            if (isGroupMessage && context.group_id) {
                await qqBot.upload_group_file({
                    group_id: Number(context.group_id),
                    file: 'data:file;base64,' + file,
                    name: logName+'.log'
                })

            } else {
                await qqBot.upload_private_file({
                    user_id: Number(context.sender.user_id),
                    file: 'data:file;base64,' + file,
                    name: logName+'.log'
                })
            }

            return '上传成功';
        } catch (error:any) {
            botlogger.error('文件查找失败：' + error.message);
            return '插件查找服务暂不可用';
        }
    }

}