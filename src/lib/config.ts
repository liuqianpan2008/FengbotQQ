//读取配置文件
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function loadConfig(file: string): Promise<any> {
    const configPath = path.join(__dirname, `../config/${file}.yml`);  // 保持源码与编译后一致
    return await yaml.load(fs.readFileSync(configPath, 'utf8')) as any;
}
export function saveConfig(file: string, data: any): void {
    const configPath = path.join(__dirname, `../config/${file}.yml`);  // 保持源码与编译后一致
    fs.writeFileSync(configPath, yaml.dump(data));
}

export const Botconfig = await loadConfig('bot');
export const PermissionConfig = await loadConfig('permission');
export const load = await loadConfig('load')
export const economy = await loadConfig('economy')
export const mccfg = await loadConfig('mc')
