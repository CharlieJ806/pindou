# 部署到 GitHub + Cloudflare Pages

目标：

```text
本地项目 → GitHub 仓库 → Cloudflare Pages → 自己的域名
```

这是一个纯静态站点，没有构建步骤、没有后端、没有环境变量。Cloudflare Pages 直接托管仓库里的 `index.html` 等文件即可。

## 1. 创建 GitHub 仓库

仓库根目录就是当前 `pindou-studio/`，不要多套一层文件夹。

### 方式 A：网页创建（推荐先手动建空仓库）

在 GitHub 新建一个 **空仓库**（不要勾选 README / .gitignore / license），例如：

```text
https://github.com/<你的用户名>/pindou-studio
```

然后在 PowerShell 里：

```powershell
cd Z:\Files\Apps\pindou-studio

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<你的用户名>/pindou-studio.git
git push -u origin main
```

如果本机已经用 SSH 登录 GitHub，也可以把 remote 换成：

```powershell
git remote add origin git@github.com:<你的用户名>/pindou-studio.git
```

### 方式 B：用 GitHub CLI 创建并推送

本机已登录 `gh` 时：

```powershell
cd Z:\Files\Apps\pindou-studio
gh repo create pindou-studio --private --source=. --remote=origin --push
```

想公开就把 `--private` 改成 `--public`。

> 私有仓库也能部署到 Cloudflare Pages，只需要在 Cloudflare 授权 GitHub App 时允许访问这个仓库。

## 2. 连接 Cloudflare Pages

1. 登录 Cloudflare Dashboard。
2. 进入 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 授权 GitHub，选择刚创建的仓库。
4. 设置：
   - **Project name**：`pindou-studio`（或你喜欢的名字，会生成 `*.pages.dev`）
   - **Production branch**：`main`
   - **Framework preset**：`None`
   - **Build command**：留空（如果界面强制要求，填 `exit 0`）
   - **Build output directory**：`/`
   - **Root directory**：`/`
5. 点 **Save and Deploy**。

首次部署完成后会得到一个：

```text
https://<project-name>.pages.dev
```

先打开确认功能正常，再去绑域名。

> 以后每次 `git push` 到 `main`，Cloudflare 会自动重新部署。其他分支会生成预览地址。

## 3. 绑定自己的域名

### 情况 A：域名已经托管在 Cloudflare（推荐）

1. Cloudflare Dashboard → 你的 Pages 项目 → **Custom domains**。
2. **Set up a custom domain**。
3. 输入：
   - 子域名：`pindou.example.com`，或
   - 顶点域名：`example.com`
4. Cloudflare 会自动创建/提示对应的 DNS 记录。
5. 如果这个主机名已有冲突的 A / CNAME 记录，先删掉旧记录。
6. 等待状态变成 **Active**。

建议同时绑定：

```text
example.com
www.example.com
```

然后在 Cloudflare 用 **Redirect Rules** 把 `www` 301 到主域名（或反过来），只保留一个规范地址。

### 情况 B：域名不在 Cloudflare

最稳的做法是把域名的 **Nameservers** 改到 Cloudflare：

1. Cloudflare → Add a site → 输入域名。
2. 选择 Free 计划。
3. 到域名注册商处，把 NS 改成 Cloudflare 给的两个地址。
4. 等待 Cloudflare 显示 **Active**（通常几分钟到几小时，最长 24 小时）。
5. 再回到 Pages → Custom domains 添加域名。

如果暂时不想迁 NS：

- 子域名可以在原 DNS 服务商加一条 CNAME，指向 `<project-name>.pages.dev`；
- 顶点域名（`example.com`）通常不支持裸 CNAME，可能无法直接绑定，建议还是迁 NS。

## 4. SSL / HTTPS

Cloudflare Pages 会自动签发证书。检查：

- **SSL/TLS → Overview**：加密模式选 **Full (strict)**
- **SSL/TLS → Edge Certificates**：开启 **Always Use HTTPS**

绑定完成后，`https://你的域名` 应该能直接打开。

## 5. 以后怎么更新

```powershell
cd Z:\Files\Apps\pindou-studio

git add .
git commit -m "更新说明"
git push
```

Cloudflare 会自动构建部署。浏览器如果看到旧版本，先强制刷新（`Ctrl+F5`）或等一两分钟。

## 6. 重要：旧项目不会自动跟到新域名

项目保存在浏览器的 `localStorage` 里，而 `file://` 和 `https://你的域名` 是**不同来源**，所以旧项目不会自动出现。

如果旧项目还要用，在旧页面和新页面的浏览器 Console 里手动搬一次：

```js
// 1. 在旧 file:// 页面 Console 执行
copy(localStorage.getItem('pindou.studio.v1'))
copy(localStorage.getItem('pindou.studio.last'))

// 2. 在新 https 页面 Console 执行（粘贴上一步复制的内容）
localStorage.setItem('pindou.studio.v1', '这里粘贴第一段 JSON')
localStorage.setItem('pindou.studio.last', '这里粘贴项目 id')
location.reload()
```

如果旧项目不多，也可以不用迁移，直接从新站重新上传图片。

## 7. 常见问题

### 打开是 404

确认仓库根目录直接有 `index.html`，并且 Cloudflare 的 **Build output directory** 是 `/`，不是 `dist`。

### 页面能开但样式/脚本 404

确认 `index.html` 里引用的是相对路径：

```html
<link rel="stylesheet" href="styles.css">
<script src="app.js"></script>
```

不要改成以 `/` 开头的绝对路径，除非你确定站点部署在域名根目录。

### 域名一直 Pending

- 检查 DNS 记录是否冲突；
- 检查域名是否已经 Active 在 Cloudflare；
- 等待证书签发，通常几分钟；
- 顶点域名优先用 Cloudflare DNS。

### 更新后还是旧页面

`Ctrl+F5` 强制刷新，或换无痕窗口确认。Cloudflare Pages 每次部署会更新边缘缓存，但浏览器可能还缓存旧文件。

### 想手动部署，不走 Git 集成

```powershell
npx wrangler pages deploy . --project-name pindou-studio
```

需要先 `npx wrangler login` 并选择账号。日常还是推荐 Git 集成，push 即部署。

## 8. 安全 / 维护

- 仓库里没有密钥、没有 `.env`、没有后端，纯静态文件。
- `_headers` 已经配置了基础安全响应头（`nosniff`、`SAMEORIGIN`、`Referrer-Policy`、`Permissions-Policy`）。
- 图片不会上传到服务器；背景去除、拼豆转换全部在浏览器本地完成。
- Cloudflare Pages 免费计划对静态站点没有流量/请求数费用，构建次数有月度上限；个人项目足够。
