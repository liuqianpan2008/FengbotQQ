import { PermissionConfig, saveConfig, savePermission } from "./config.js";
import botlogger from "./logger.js";
export const IsAdmin = async function (id:number){return await PermissionConfig.admins.some((admin: string) => admin === String(id)) }
export async function IsPermission(id: number, plugin: string, command: string): Promise<boolean> {
    try {
        // 检查用户是否在管理员
        if (await IsAdmin(id)) {
            return true;
        }
        // 获取用户权限配置（带默认回退）
        const userPermission = getUserPermission(id);
        
        // 获取插件配置（带默认回退）
        const pluginConfig = getPluginConfig(userPermission, plugin);
        
        // 检查插件总开关
        if (pluginConfig?.enable === false) return false;

        // 获取命令权限配置
        const commandPermission = getCommandPermission(pluginConfig, command);
        
        // 自动保存新配置
        if (commandPermission === undefined) {
            await saveNewCommandConfig(id, plugin, command);
            return true; // 默认允许新命令
        }
        
        return Boolean(commandPermission);
    } catch (error) {
        if (error instanceof Error) {
            botlogger.error(`权限检查失败 [${id}/${plugin}/${command}]：${error.message}`);
        } else {
            botlogger.error(`权限检查失败 [${id}/${plugin}/${command}]：未知错误`);
        }
        return false; // 出错时默认拒绝
    }
}

// 新增辅助函数
function getUserPermission(id: number) {
    // 确保默认配置层级存在
    if (!PermissionConfig.users.default) {
        PermissionConfig.users.default = { plugins: {} };
    }
    if (!PermissionConfig.users.default.plugins) {
        PermissionConfig.users.default.plugins = {};
    }
    
    // 深度合并用户配置与默认配置
    return {
        plugins: {
            ...PermissionConfig.users.default.plugins,
            ...(PermissionConfig.users[id]?.plugins || {})
        }
    };
}

async function saveNewCommandConfig(id: number, plugin: string, command: string) {
    try {
        // 初始化用户配置树
        PermissionConfig.users[id] = PermissionConfig.users[id] || { plugins: {} };
        PermissionConfig.users[id].plugins[plugin] = PermissionConfig.users[id].plugins[plugin] || { commands: {} };
        PermissionConfig.users[id].plugins[plugin].commands = PermissionConfig.users[id].plugins[plugin].commands || {};
        
        // 设置新命令默认权限
        PermissionConfig.users[id].plugins[plugin].commands[command] = true;
        
        savePermission('permission', PermissionConfig);
        botlogger.info(`自动创建 [${id}] 的 ${plugin}.${command} 命令权限`);
    } catch (error) {
        botlogger.error(`配置保存失败：${error instanceof Error ? error.stack : error}`);
    }
}
function getPluginConfig(userPermission: any, plugin: string) {
    const PluginConfig = userPermission?.plugins[plugin]
    return PluginConfig ?? PermissionConfig.users.default.plugins[plugin];
}

function getCommandPermission(pluginConfig: any, command: string) {
    return pluginConfig?.commands[command];
}