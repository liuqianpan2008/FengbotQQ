import { param, ParamType, plugins, runcod } from '../lib/decorators.js';
import path from 'path';
import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { GroupMessage, PrivateFriendMessage, PrivateGroupMessage } from 'node-napcat-ts';
import botlogger from '../lib/logger.js';
import fs from 'fs/promises';
import { qqBot } from '../app.js';

@plugins({
    id: "downloadPlugins", //插件ID，必须唯一，不能重复
    name: "下载插件", //插件名称，用于显示在菜单中
    version: "1.0.0", //插件版本号，用于显示在菜单中
    describe: "在服务器下载一个插件", //插件描述，用于显示在菜单中
    author: "枫叶秋林",//插件作者，用于显示在菜单中
    help: { //插件帮助信息，用于显示在菜单中
        enabled: true, //是否启用帮助信息
        description: "显示帮助信息" //帮助信息描述
    }
})
export class downloadPlugins {
    @runcod(["download","下载插件"], "下载插件")//命令装饰器，用于注册命令
    async param(
        @param("插件名称", ParamType.String) pluName: string,
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        // pluName += ".ts"
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', 'plugins');
        try {
            const files = await fs.readdir(pluginsDir);
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

            const file = Buffer.from(await fs.readFile(fullPath, { encoding: "utf-8" })).toString('base64')
            const isGroupMessage = context.message_type === 'group';
            if (isGroupMessage && context.group_id) {
                await qqBot.upload_group_file({
                    group_id: Number(context.group_id),
                    file: 'data:file;base64,'+file,
                    name: pluName
                })
                
            } else {
                await qqBot.upload_private_file({
                    user_id: Number(context.sender.user_id),
                    file: 'data:file;base64,'+file,
                    name: pluName
                })
            }
           
            return'上传成功';
        } catch (error) {
            botlogger.error('文件查找失败：', error);
            return '插件查找服务暂不可用';
        }
    }
    @runcod(["plugins","插件列表"], "查看插件文件")//命令装饰器，用于注册命令
    async plugins(
        context: PrivateFriendMessage | PrivateGroupMessage | GroupMessage
    ): Promise<any> {
        // pluName += ".ts"
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // 查找插件目录下的文件
        const pluginsDir = path.join(__dirname, '..', 'plugins');
        try {
            const files = await fs.readdir(pluginsDir);
            const foundFiles = files.filter(file => 
                (file.endsWith('.ts') || file.endsWith('.js')) && 
                file !== 'index.ts'
            );
            return `找到插件文件：${foundFiles.join(', ')}`;
        } catch (error) {
            botlogger.error('文件查找失败：', error);
            return '插件查找服务暂不可用';
        }
    }
}