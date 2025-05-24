import { param, plugins, runcod } from '../lib/decorators.js';
import path from 'path';
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage } from 'node-napcat-ts';
import botlogger from '../lib/logger.js';
import * as fs from 'fs'
import { qqBot } from '../app.js';
import { ParamType } from '../interface/plugin.js';
import { load, PermissionConfig, saveConfig } from '../lib/config.js';
import { download } from '../lib/download.js';
import { IsAdmin } from '../lib/Permission.js';

@plugins({
    name: "插件文件管理", //插件名称，用于显示在菜单中
    version: "1.0.1", //插件版本号，用于显示在菜单中
    describe: "可以查看服务器的插件/日志，可以上传插件到群内", 
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class PluginsFile {
    constructor() {
        if (load.enable==true){
            qqBot.on('message', async (context) => {
                try {
                    if (context.message[0].type === "file") {
                        const file = context.message[0].data;
                        botlogger.info("收到文件消息:" + JSON.stringify(file));
                        if (file.file.includes(".ts")) {
                            if (!IsAdmin(context.sender.user_id)) {
                                context.quick_action([{
                                    type: 'text',
                                    data: { text: `无权限，无法加载插件` }
                                }]);
                                return;
                            }
                            const url = (file as any).url; // 文件URL
                            await download(url, `../plugins/${file.file}`);
                            botlogger.info("下载完成:" + JSON.stringify(file));
                            context.quick_action([{
                                type: 'text',
                                data: { text: `插件下载完成,开始重载` }
                            }]);
                            let isload = load
                            isload.isuplad = true;
                            isload.name = file.file
                            if ((context.message_type === 'group')) {
                                isload.id = context.group_id
                            } else {
                                isload.id = context.sender.user_id
                            }
                            isload.isGroupMessage = (context.message_type === 'group');
                            saveConfig("load", isload)
                        }
                        return;
                    }
                    if (context.message[0].type !== 'text') {
                        return;
                    }
                    const msg = context.message[0].data.text || '';
                    if (msg.startsWith("//PLUGIN ")) {
                        const endOfLine = msg.indexOf("\n");
                        if (endOfLine !== -1) {
                            const pluginName = msg.substring(9, endOfLine).trim();
                            if (pluginName.endsWith(".ts")) {
                                if (!IsAdmin) {
                                    context.quick_action([{
                                        type: 'text',
                                        data: { text: `无权限，无法加载插件` }
                                    }]);
                                    return;
                                }
                                botlogger.info("开始安装插件: " + pluginName);
                                const __dirname = path.dirname(fileURLToPath(import.meta.url));
                                // @ts-ignore
                                fs.writeFileSync(path.join(__dirname, "..", "plugins", pluginName), msg, "utf8");
                                context.quick_action([{
                                    type: 'text',
                                    data: { text: `插件下载完成,开始重载` }
                                }]);
                                let isload = load
                                isload.isuplad = true;
                                isload.name = pluginName
                                if ((context.message_type === 'group')) {
                                    isload.id = context.group_id
                                } else {
                                    isload.id = context.sender.user_id
                                }
                                isload.isGroupMessage = (context.message_type === 'group');
                                saveConfig("load", isload)
                            }
                        }
                    }
                } catch (error) {
                    botlogger.error("处理消息时出错:", error);
                    await context.quick_action([{
                        type: 'text',
                        data: { text: `处理消息时出错: ${error instanceof Error ? error.message : '未知错误'}` }
                    }]);
                }
                // 检查消息类型和内容
               
            })
        }
    }
    @runcod(["download", "下载插件"], "下载插件")
    async download(
        @param("插件名称", ParamType.String) pluName: string,
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', 'plugins');
        try {
            const files = await fs.promises.readdir(pluginsDir);
            const foundFiles = files.filter(file =>
                (file.endsWith('.ts') || file.endsWith('.js')) &&
                file !== 'index.ts'
            );
            // 在服务器日志中输出找到的文件列表
            botlogger.info(`找到插件文件：${foundFiles.join(', ')}`);

            // 根据文件名查找具体插件
            const targetFile = foundFiles.find((file: string) =>
                path.parse(file).name.toLowerCase() === pluName.toLowerCase()
            );

            if (!targetFile) {
                return `未找到名为 ${pluName} 的插件`;
            }

            // 返回文件完整路径
            const fullPath = path.join(pluginsDir, targetFile);
            //.toString('base64'

            const file = Buffer.from(await fs.promises.readFile(fullPath, { encoding: "utf-8" })).toString('base64')
            const isGroupMessage = context.message_type === 'group';
            if (isGroupMessage && context.group_id) {
                await qqBot.upload_group_file({
                    group_id: Number(context.group_id),
                    file: 'data:file;base64,' + file,
                    name: pluName + '.ts'
                })

            } else {
                await qqBot.upload_private_file({
                    user_id: Number(context.sender.user_id),
                    file: 'data:file;base64,' + file,
                    name: pluName + '.ts'
                })
            }

            return '上传成功';
        } catch (error) {
            botlogger.error('文件查找失败：', error);
            return '插件查找服务暂不可用';
        }
    }

    @runcod(["plugins", "插件列表"], "查看插件文件")
    async plugins(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        // pluName += ".ts"
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', 'plugins');
        try {
            const files = await fs.promises.readdir(pluginsDir);
            const foundFiles = files.filter(file =>
                (file.endsWith('.ts') || file.endsWith('.js')) &&
                file !== 'index.ts'
            );
            foundFiles.forEach((file, index) => {
                foundFiles[index] = path.parse(file).name;
            })
            return `找到插件文件：${foundFiles.join(', ')}`;
        } catch (error) {
            botlogger.error('文件查找失败：', error);
            return '插件查找服务暂不可用';
        }
    }

}