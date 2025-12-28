import * as yaml from 'js-yaml'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSync(file: string): any {
    const configPath = path.join(__dirname, `../config/${file}.yaml`);
    console.log('[Config] Loading:', configPath);
    const content = fs.readFileSync(configPath, 'utf8');
    console.log('[Config] Raw Content:', JSON.stringify(content));
    const parsed = yaml.load(content);
    console.log('[Config] Parsed:', JSON.stringify(parsed));
    console.log('[Config] Type:', typeof parsed);
    console.log('[Config] Keys:', Object.keys(parsed as object));
    return parsed;
}

export const Botconfig = loadSync('bot').bot;
export const Cmdconfig = loadSync('bot').cmd;
