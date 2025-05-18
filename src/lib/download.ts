import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
async function downloadFile(url: string, savePath: string) {
     const response = await axios.get(url, { responseType: 'stream' });
     const writer = fs.createWriteStream(savePath);
     response.data.pipe(writer);
     return new Promise((resolve, reject) => {
         writer.on('finish', resolve);
         writer.on('error', reject);
     });
}
export async function download(url: string, savePath: string) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const fullSavePath = path.join(__dirname, savePath);
    await downloadFile(url, fullSavePath);
}
