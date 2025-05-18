//读取配置文件
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../config/bot.yml');  // 保持源码与编译后一致
export const Botconfig = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;