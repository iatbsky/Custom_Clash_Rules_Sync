# Custom Clash Rules Sync

直接同步 [Aethersailor/Custom_OpenClash_Rules](https://github.com/Aethersailor/Custom_OpenClash_Rules) 的独立仓库，不合并原仓库的 Git 历史。

## 自动更新

- 每天香港时间 12:00 自动同步，也可以在 Actions → Sync upstream templates → Run workflow 手动运行。
- 只复制上游 `cfg/` 顶层的 `.ini` 模板，不执行上游脚本或工作流。
- `cfg/` 保留上游内容，`cfg/fb/` 生成定制模板。
- 定制保持旧仓库行为：地区测速组添加 `(^(?!.*V4).*)`，在“漏网之鱼”后添加匹配 `V4|V3` 的“🎮 游戏加速”分组。
- `sync-source.json` 记录同步来源、提交和文件列表；内容未变化时不创建提交。
- 上游删除的文件不会自动从本仓库删除，避免订阅链接突然失效；这些文件之后不会获得更新。
- 不继承旧衍生项目特有的 Android/iOS/BackHome 模板。上游模板面向 OpenClash，其他客户端需要自行验证兼容性。

## 创建与启用

1. 创建公开仓库 `Custom_Clash_Rules_Sync`，默认分支使用 `main`。
2. 解压本项目，把整个目录内容上传到仓库，必须包含 `.github/workflows/sync.yml`。
3. 首次提交工作流会触发同步。如果 Actions 未启用，先启用后手动运行。
4. 在 Actions 查看任务是否成功。若组织策略阻止写入，需允许工作流写入仓库内容。

上传也可以通过 Git 完成（新建空仓库后，在本目录运行）：

```powershell
git init -b main
git add .
git commit -m "Set up direct upstream template sync"
git remote add origin https://github.com/iatbsky/Custom_Clash_Rules_Sync.git
git push -u origin main
```

订阅转换模板地址示例：

```text
https://raw.githubusercontent.com/iatbsky/Custom_Clash_Rules_Sync/main/cfg/Custom_Clash.ini
https://raw.githubusercontent.com/iatbsky/Custom_Clash_Rules_Sync/main/cfg/fb/Custom_Clash.ini
```

## 本地验证

需要 Node.js 22：

```text
node --test tests/sync-templates.test.mjs
```

## 来源说明

模板及其规则引用来自上游项目，相关说明和使用条件请查阅上游仓库。本仓库只维护同步和定制生成工具，不将上游模板标记为原创。
