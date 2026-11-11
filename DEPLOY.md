# 部署到 pindou.pokedriver.me

当前状态：

```text
GitHub 仓库：https://github.com/CharlieJ806/pindou  （public，main 已推送）
本地目录：  Z:\Files\Apps\pindou-studio
目标域名：  https://pindou.pokedriver.me
DNS：       pokedriver.me 已在 Cloudflare
```

`pokedriver.me` 根域名目前有一个 Next.js 站点在跑，所以**不要绑定根域名**，使用子域名 `pindou.pokedriver.me`，不会影响现有站点。

这是一个纯静态站点，没有构建步骤、没有后端、没有环境变量。Cloudflare Pages 直接托管仓库根目录即可。

## 1. 连接 Cloudflare Pages

1. 登录 <https://dash.cloudflare.com/>。
2. 左侧 **Workers & Pages** → **Create**。
3. 选 **Pages** → **Connect to Git**。
4. 授权 GitHub，选择仓库 `CharlieJ806/pindou`。
5. 填写：

| 配置 | 值 |
| --- | --- |
| Project name | `pindou-studio`（被占用就换 `pindou-pattern` 等） |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | 留空；如果强制要求，填 `exit 0` |
| Build output directory | `/` |
| Root directory | `/` |

6. **Save and Deploy**。

部署完成后先打开：

```text
https://<project-name>.pages.dev
```

确认页面、上传、构图、去背景、PNG 导出都正常，再绑域名。

## 2. 绑定 pindou.pokedriver.me

在 Pages 项目里：

1. **Custom domains** → **Set up a custom domain**。
2. 输入：

```text
pindou.pokedriver.me
```

3. 因为 `pokedriver.me` 已经在 Cloudflare，Cloudflare 会自动添加一条 `pindou` 的 CNAME，指向 `<project-name>.pages.dev`，并自动签证书。
4. 等待状态变成 **Active**。
5. 打开 `https://pindou.pokedriver.me` 验证。

如果 DNS 没有自动加，手动在 Cloudflare DNS 里加：

```text
类型：CNAME
名称：pindou
目标：<project-name>.pages.dev
代理：已代理（橙色云）
```

**不要动** `pokedriver.me` 和 `www` 现有的记录，避免影响原来的 Next.js 站点。

## 3. SSL 设置

Cloudflare Dashboard → 你的域名 → **SSL/TLS**：

- Overview → 加密模式：**Full (strict)**
- Edge Certificates → 开启 **Always Use HTTPS**

## 4. 以后更新

```powershell
cd Z:\Files\Apps\pindou-studio

git add .
git commit -m "更新说明"
git push
```

Cloudflare Pages 会自动重新部署 `main`。浏览器看到旧版本就 `Ctrl+F5`。

## 5. 关于旧项目数据

项目存放在浏览器 `localStorage`，而 `file://` 和 `https://pindou.pokedriver.me` 是不同来源，旧项目不会自动出现。你之前确认过新站重新开始，所以可以忽略。

如果以后需要迁移，可以在旧页面和新页面 Console 里手动搬：

```js
// 旧 file:// 页面
copy(localStorage.getItem('pindou.studio.v1'))
copy(localStorage.getItem('pindou.studio.last'))

// 新 https 页面
localStorage.setItem('pindou.studio.v1', '粘贴第一段')
localStorage.setItem('pindou.studio.last', '粘贴项目 id')
location.reload()
```

## 6. 故障排查

**404**

确认仓库根目录直接有 `index.html`，Cloudflare 的 Build output directory 是 `/`，不是 `dist`。

**样式或脚本 404**

`index.html` 里使用相对路径：

```html
<link rel="stylesheet" href="styles.css">
<script src="app.js"></script>
```

**域名一直 Pending**

- 确认 `pindou` 没有冲突的 A/CNAME 记录；
- 确认 Pages 项目和域名在同一个 Cloudflare 账号；
- 等证书签发，通常几分钟。

**更新后还是旧页面**

`Ctrl+F5` 强制刷新，或换无痕窗口确认。

## 7. 可选：命令行部署

不用 Git 集成时：

```powershell
npx wrangler pages deploy . --project-name pindou-studio
```

需要先 `npx wrangler login`。日常推荐 Git 集成。

## 8. 安全

- 仓库没有密钥、`.env` 或后端代码。
- `_headers` 已配置基础安全头。
- 图片处理、背景去除、拼豆转换全部在浏览器本地完成，不上传服务器。
- Cloudflare 免费计划对静态站点没有流量/请求数费用，个人项目足够。
