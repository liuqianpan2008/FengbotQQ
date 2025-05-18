//PLUGIN sakulin.ts

import {param, ParamType, plugins, runcod} from '../lib/decorators.js';
import 'reflect-metadata';


const imgSourceMap: { [key: string]: string } = {
    "二次元": "https://app.zichen.zone/api/acg/api.php",
    "原神": "https://t.alcy.cc/ysz",
    "三次元": "https://api.lolimi.cn/API/tup/xjj.php",
    "碧蓝档案": "https://image.anosu.top/pixiv/direct?r18=0&keyword=bluearchive",
    "碧蓝航线": "https://image.anosu.top/pixiv/direct?r18=0&keyword=azurlane",
    "明日方舟": "https://image.anosu.top/pixiv/direct?r18=0&keyword=arknights",
    "公主连接": "https://image.anosu.top/pixiv/direct?r18=0&keyword=princess",
    "东方": "https://image.anosu.top/pixiv/direct?r18=0&keyword=touhou"
};

const defaultSource = "三次元";


@plugins({
    id: "saku",
    name: "Sakulin Helper",
    version: "1.0.0",
    describe: "This is a plugin by Sakulin",
    author: "活性红磷",
    help: {
        enabled: true,
        description: "显示帮助信息"
    }
})
export class sakulass {
    @runcod(["ping", "test"], "测试接口")
    async test() {
        await (new Promise((resolve) => {
            setTimeout(resolve, 5000);
        }));
        return "pong";
    }

    @runcod(["图", "tu"], "看看图，可添加不同图源作为参数，例如发送 “#saku 图 原神” ，可选的图源有：" + Object.keys(imgSourceMap).map(e => ((e == defaultSource) ? (e + "（默认）") : e)).join("、"))
    async image(
        @param("图源", ParamType.String) type: string,
    ) {

        const source = imgSourceMap[type] ?? imgSourceMap[defaultSource];

        try {
            const response = await fetch(source);
            const blob = await response.blob();

            return {
                picture: {
                    enabled: true,
                    supplement: "测试图片",
                    base64: Buffer.from(await blob.arrayBuffer()).toString("base64")
                }
            }
        } catch (e) {
            return `获取时发生错误：${JSON.stringify(e)}`;
        }
    }
}