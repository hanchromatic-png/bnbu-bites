# BNBU Bites — 独立部署版

学生端无需 ChatGPT 或其他账号；后台使用管理员邮箱、密码登录。原 ChatGPT Sites 网站尚未切换。本包尚未上线。

## 包含内容

- 学生端校园示意地图、48 家餐厅、1550 条菜品/规格和原有图片。
- 国家/地区与可编辑的饮食偏好；中英界面。
- 管理员点位、餐厅、菜单、图片管理，保存草稿和确认发布。
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

本包初始数据来自上一版源码种子，**不包含旧站点上线后在后台产生的新草稿、已发布更改或新上传图片**。切换前若旧站点发生过编辑，应导出并核对草稿以及已发布版本，同时下载旧站新上传的图片；核对后才能导入。不把待核对草稿自动作为学生端公开数据。

SQLite 数据库、会话和上传图片均在 DATA_DIR 内。不要把该目录加入 Git 或作为静态目录发布；定期停服备份整个目录（包含数据库、WAL 和 uploads）。迁移机器需一起迁移数据目录。无持久化磁盘的部署重启或重建可能丢数据。

## 验证和限制

`npm test` 直接测试请求处理器：公开查看、登录、伪造 ChatGPT 身份头无效、跨站请求拒绝、未登录拦截、版本冲突、发布、图片格式检查、重开数据库持久化、退出和限流。尚未进行真实公网部署、TLS、代理或移动端浏览器验证。

校园建筑高度和地图坐标仍是示意，不能当作 GPS 步行导航。过敏原仍是未核实配方线索。

public/vendor 为已构建的开源前端组件，许可证见 THIRD_PARTY_NOTICES.md 和 vendor 中的 LICENSE 文件。ui-source 保存本项目地图/偏好组件源码供后续修改参考；运行服务器直接使用 public 中已有成品，不需要重建前端。

参考：
- https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
- https://docs.railway.com/services
- https://docs.railway.com/volumes/reference
