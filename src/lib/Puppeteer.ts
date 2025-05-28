import puppeteer, { Browser, PuppeteerLaunchOptions } from 'puppeteer';
import art from 'art-template';
import * as fs from 'fs';
import botlogger from './logger.js';

export class HtmlImg {
    private browser: Browser | null = null;

    async init() {
        if (!this.browser) {
            const options: PuppeteerLaunchOptions = {
                headless: true, // 无头模式，可根据需要设置为false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--allow-file-access-from-files' // 新增参数
                ]
            };
            this.browser = await puppeteer.launch(options);
        }
    }

    async render(options: {
        url?: string;
        template: string;
        templateIsPath?: boolean;
        data: any;
        width?: number;
        height?: number;
        type?: string;
        quality?: number;
        fullPage?: boolean;
        background?: boolean;
    }) {
        try {
            await this.init();
            const {
                url,
                template,
                templateIsPath = true,
                data,
                width = -1,
                height = -1,
                type = 'png',
                quality = 100,
                fullPage = false,
                background = true
            } = options;

            // 读取模板
            const templateContent = templateIsPath ? fs.readFileSync(template, 'utf-8') : template;

            // 渲染HTML
            let html = '';
            if (templateContent) {
                html = art.render(templateContent, data);
            }
            // 计算高度

            // 创建页面
            const page = await this.browser!.newPage();
            await page.setViewport({ width, height });
            // 设置页面内容
            if (url) {
                await page.goto(url);
                await page.emulate({
                    viewport: { width: 375, height: 667 },
                    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
                });
                await page.waitForNetworkIdle();
                if(data.selector){
                    const element = await page.$(data.selector);
                    if (element) {
                        const image = await element.screenshot({ type: type as 'png' | 'jpeg', quality: type === 'jpeg'? quality : undefined });
                        return image;
                    }
                }
                //加载额外的js
                page.evaluate(data.urlJs)
            }else{
                await page.setContent(html, { waitUntil: 'networkidle0' });
            }
            // 获取document.body.scrollHeight
            
           
            const bodyheight = await page.evaluate(() => document.body.scrollHeight)  as number;
            const bodywidth = await page.evaluate(() => document.body.scrollWidth)  as number;
            botlogger.info(`获取body高度${bodyheight}和宽度${bodywidth}`)
            if(-1 != height &&  -1 != width){
                await page.setViewport({ width: bodywidth, height: bodyheight });
                await page.waitForNetworkIdle();
            }
            // 截图
            const image = await page.screenshot({
                type: type as 'png' | 'jpeg',
                quality: type === 'jpeg' ? quality : undefined,
                fullPage,
                omitBackground: !background
            });

            await page.close();
            return image;

        } catch (error) {
            botlogger.error('渲染图片失败:', error);
            throw error;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}