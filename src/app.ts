import { Bot } from "./lib/Bot.js";
import botlogger from './lib/logger.js';
export const qqBot = new Bot()
async function main() {
  try {
      // 启动机器人
      botlogger.info("正在启动机器人...");
      await qqBot.run();
      botlogger.info("机器人启动成功");
  } catch (error) {
      botlogger.error("启动失败:", error);
      process.exit(1);
  }
}

// 启动应用
main().catch(error => {
  botlogger.error("程序异常退出:", error);
  process.exit(1);
});

// 处理进程退出
process.on('SIGINT', () => {
  botlogger.info("正在关闭机器人...");
  qqBot.disconnect();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('[致命错误]', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[未处理的Promise拒绝]', reason);
});