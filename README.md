# Wishstar · 愿望星

每天写下一个愿望，让它成为只属于你的星星。

## 功能

- 每天一个愿望，自动保存未提交草稿
- IndexedDB 本机持久化，不上传愿望内容
- 星空筛选、时光回望与实现状态
- JSON 导出、合并或覆盖导入
- 手机优先，支持减少动态效果

## 开发

```bash
npm install
npm run dev
```

测试与构建：

```bash
npm test
npm run build
```

## 部署

推送 `main` 后由 GitHub Actions 自动部署到 GitHub Pages：

<https://yananetlab.github.io/wishstar/>

首次部署需在仓库 `Settings → Pages` 中将 `Source` 设为 `GitHub Actions`。
