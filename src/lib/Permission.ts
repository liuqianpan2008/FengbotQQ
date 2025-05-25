import { PermissionConfig } from "./config.js";
import botlogger from "./logger.js";
import { PermissionCommands } from "../interface/Permission.js";
import { getUserData, saveUserData } from "./economy.js";
export const IsAdmin = async function (id:number){return await PermissionConfig.admins.some((admin: string) => admin === String(id)) }
export const permissionCommands:PermissionCommands[] = [];

export function Permission(type: 'Admin'| 'User' | 'Group'): MethodDecorator {
    return function (target: any, propertyKey: string | symbol | undefined): void {
        const actualPropertyKey = propertyKey!;
        const fnName = `${target.constructor.name}.${actualPropertyKey.toString()}`;
        const EconomyCommand: PermissionCommands = {
            name: fnName,
            type: type,
        };
        permissionCommands.push(EconomyCommand)
    };
}


export async function IsPermission(user_id: number, plugin: string, command: string,IsGroup:boolean): Promise<boolean> {
    const permission = await permissionCommands.find((permission: PermissionCommands) => permission.name === `${plugin}.${command}`);
    if (permission) {
        switch (permission.type) {
            case 'Admin':
                return await IsAdmin(user_id);
            case 'User':
                return await IsuserPermission(user_id, plugin, command);
            case 'Group':
                if(IsGroup){
                    return await IsuserPermission(user_id, plugin, command);
                }
                return false
            default:
                botlogger.error(`未知权限类型 ${permission.type}`);
            return false
        }
    }
    return true;
}
async function IsuserPermission(user_id: number, plugin: string, command: string): Promise<boolean> {
    if (await IsAdmin(user_id)) {
        return true;
    }
    if (!await getUserData(user_id.toString())) {
        return false;
    }
    const permission = (await getuserPermissions(user_id.toString())).find((permission) => permission === `${plugin}.${command}`);
    if (permission) {
        return true;
    } 
    return false;
}
export async function getuserPermissions(userId: string): Promise<string[]> {
    const userData = await getUserData(userId);
    if (!userData) {
        return [];
    }else{
        return userData.Permission;
    }
}
export async function addPermission(userId: string, plugin: string, command: string) : Promise<boolean>{
    const userPermission = await getuserPermissions(userId) || [];
    const permission = permissionCommands.find((permission) => permission.name === plugin + '.' + command);
    if (permission && !userPermission.includes(plugin + '.' + command)) {
        userPermission.push(plugin + '.' + command);
    }
    const userData = await getUserData(userId)
    if (!userData) {
        return false;
    }
    userData.Permission = userPermission;
    await saveUserData(userId,userData);
    return true;
}
export async function removePermission(userId: string, plugin: string, command: string) : Promise<boolean>{
    const userPermission = await getuserPermissions(userId) || [];
    const permission = permissionCommands.find((permission) => permission.name === plugin + '.' + command);
    if (permission && userPermission.includes(plugin + '.' + command)) {
        userPermission.splice(userPermission.indexOf(plugin + '.' + command), 1);
    }
    const userData = await getUserData(userId)
    if (!userData) {
        return false;
    }
    userData.Permission = userPermission;
    await saveUserData(userId,userData);
    return true;
}