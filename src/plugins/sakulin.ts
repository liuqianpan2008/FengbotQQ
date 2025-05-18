import { plugins, runcod } from '../lib/decorators.js';
import 'reflect-metadata';

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
        await ((ms) => new Promise((resolve) => {setTimeout(resolve, ms);}))(500);
        return "pong";
    }
}