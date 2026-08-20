/* 小游戏入口。微信从这里开始执行。
   诊断用的启动自检在 js/selftest.js，需要时手动 require 调用，
   不放在启动路径上——它要跑 100 个盘面，会拖慢冷启动。 */
require('./js/main.js').boot();
