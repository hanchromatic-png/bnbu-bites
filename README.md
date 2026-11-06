# BNBU Bites — 独立部署版

学生端无需 ChatGPT 或其他账号；后台使用管理员邮箱、密码登录。本包为 2.0 优化版本，尚未提交到线上部署。

## 包含内容

- 学生端校园示意地图、48 家餐厅、1550 条菜品/规格和原有图片。
- 国家/地区与可编辑的饮食偏好；中英界面。
- 管理员按楼栋 → 食堂 → 餐厅 → 菜单逐层管理，支持新增、编辑、移动与删除，保存草稿和确认发布。
- 36 个清晰楼号标注，楼栋高亮、地图缩放拖动、位置编辑；尚未核实的楼栋和食堂明确提示。
- 中英界面与双语内容字段；缺少英文时显示待翻译提示，不回退到中文。
- 删除楼栋或食堂保留下级内容并移入待分配；删除餐厅经确认后同步删除其菜单。
- Node.js 24 + SQLite，无需安装 npm 运行依赖。
- scrypt 密码哈希、服务器会话、HttpOnly/SameSite cookie、HTTPS Secure cookie、同源写入检查。
- 登录失败全站最多 10 次/15 分钟，适合单管理员 demo；未来多管理员需要改为细分限流。
- 会话 8 小时过期，退出立即失效，更换管理员邮箱/密码哈希会使旧会话失效。

## 部署步骤（Docker / Railway / 普通服务器）

1. 将本文件夹作为项目根目录，Dockerfile 已配好。
2. 使用 Node.js 24 在本地执行 `npm run password`，输入至少 12 位密码。终端只输出密码哈希；把它填入托管平台的私密变量 `ADMIN_PASSWORD_HASH`。不要把明文密码发到聊天或提交 Git。
3. 设置 `ADMIN_EMAIL` 为你的管理员邮箱。
4. 设置 `APP_ORIGIN` 为最终 HTTPS 网站地址（例：`https://your-domain.example`），不能填旧 ChatGPT Sites 地址。不能仅依赖请求 Host 头决定站点来源。
5. 将持久化磁盘挂载至 `/app/data`，设置 `DATA_DIR=/app/data`。确认容器 node 用户（UID 1000）有读写权限。仅部署一个实例。
6. 部署后平台将 HTTP 流量转发至 `PORT`（默认 3000）；健康检查 `/health`。
7. 学生打开 `/`，管理员打开 `/admin.html`。

Railway 支持 Dockerfile 和持久化磁盘；实际套餐、额度和账单以你的账号为准。本包不假设托管永久免费，不会自动购买资源。普通 Linux 服务器也可用 Docker 部署并在反向代理中配置 HTTPS。

## 本地运行

Node.js 24 下设置以上三项环境变量，`APP_ORIGIN=http://localhost:3000`，执行 `npm start`。本机调试可用 HTTP，公网必须 HTTPS。后台账号不对学生开放注册。密码重置通过重新生成并更换环境变量中的哈希后重启完成。

## 数据迁移与备份

2.0 读取旧数据库时自动转换为层级结构，保留原有餐厅、菜单和明确的位置关联。无法确定的楼栋归属留空，由管理员核对；不按距离猜测。先备份 DATA_DIR，再更新代码，保持 Railway 原磁盘、变量和单实例配置。不要用 seed.json 覆盖线上数据库。

本包初始数据来自上一版源码种子，**不包含旧站点上线后在后台产生的新草稿、已发布更改或新上传图片**。切换前若旧站点发生过编辑，应导出并核对草稿以及已发布版本，同时下载旧站新上传的图片；核对后才能导入。不把待核对草稿自动作为学生端公开数据。

SQLite 数据库、会话和上传图片均在 DATA_DIR 内。不要把该目录加入 Git 或作为静态目录发布；定期停服备份整个目录（包含数据库、WAL 和 uploads）。迁移机器需一起迁移数据目录。无持久化磁盘的部署重启或重建可能丢数据。

## 验证和限制

`npm test` 直接测试请求处理器：公开查看、登录、伪造 ChatGPT 身份头无效、跨站请求拒绝、未登录拦截、版本冲突、发布、图片格式检查、重开数据库持久化、退出和限流。2.0 的五项自动化测试通过；隔离预览中已测试双语显示、新建食堂/餐厅/菜品及发布流程。尚未完成新版公网、TLS、代理或移动端浏览器验证。

校园建筑高度和地图坐标仍是示意，不能当作 GPS 步行导航。过敏原仍是未核实配方线索。

public/vendor 为已构建的开源前端组件，许可证见 THIRD_PARTY_NOTICES.md 和 vendor 中的 LICENSE 文件。ui-source 保存本项目地图/偏好组件源码供后续修改参考；运行服务器直接使用 public 中已有成品，不需要重建前端。

参考：
- https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- https://docs.railway.com/services
- https://docs.railway.com/volumes/reference

## 2.0 前端入口

当前界面源码为 public/explore.js、public/admin.js、public/common.js、public/domain.js 和 public/app.css。无需前端构建。public/vendor 和 ui-source 保留旧版依赖和源码供参考，当前页面不加载旧 bites.js。地图是可编辑校园示意图，不依赖高德付费 API。
