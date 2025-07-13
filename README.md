# 安装和配置指南

## 📦 快速安装

### 1. 准备工作

确保您已经：
- 安装了最新版本的 Google Chrome
- 设置了绕过API服务（参考 `api.md`）
- 启用了Chrome开发者模式

### 2. 安装插件

1. **下载代码**
   ```bash
   git clone <repository-url>
   cd cloudflare-bypass-extension
   ```

2. **生成图标**（可选）
   ```bash
   chmod +x generate_icons.sh
   ./generate_icons.sh
   # 在浏览器中打开 icon_generator.html 下载图标文件
   ```

3. **加载插件**
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 启用右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `cloudflare-bypass-extension` 文件夹

### 3. 基础配置

1. **点击插件图标**（浏览器工具栏）
2. **配置API设置**：
   - API端点：`http://localhost:3000`（或您的API服务器地址）
   - 认证令牌：如果API需要认证，请输入token
3. **测试连接**：点击"Test API Connection"按钮
4. **启用功能**：开启"Enable Auto Bypass"开关

## ⚙️ 详细配置

### API服务设置

确保您的绕过API服务正在运行：

```bash
# 检查API服务状态
curl http://localhost:3000/health

# 测试API调用
curl -X POST http://localhost:3000/solve \
  -H "Content-Type: application/json" \
  -d '{"type":"cftoken","websiteUrl":"https://example.com","websiteKey":"test-key"}'
```

### 代理配置（可选）

如果需要使用代理：

1. 启用"Use Proxy"开关
2. 设置代理主机：`127.0.0.1`
3. 设置代理端口：`8080`
4. 保存配置

### 高级选项

- **Auto-detect captcha type**：自动识别验证码类型
- **Retry failed attempts**：自动重试失败的绕过尝试
- **Bypass Method**：选择默认的绕过方法

## 🧪 测试安装

### 1. 基本功能测试

访问包含Cloudflare保护的网站：
- 插件状态应显示为"Active"
- 检测到验证码时会自动处理
- 查看浏览器控制台的日志输出

### 2. API连接测试

在插件弹窗中：
- 点击"Test API Connection"
- 应显示"Connected!"表示成功
- 如果显示"Failed"，检查API服务和网络连接

### 3. 统计信息验证

使用一段时间后：
- 查看插件弹窗底部的统计信息
- 成功率应该大于0%
- 可以看到绕过次数统计

## 🔧 故障排除

### 常见问题

**插件无法加载**
```
解决方案：
1. 确认已启用开发者模式
2. 检查manifest.json语法是否正确
3. 查看Chrome扩展页面的错误信息
```

**API连接失败**
```
解决方案：
1. 检查API服务是否运行在正确端口
2. 确认防火墙未阻止连接
3. 验证API端点URL拼写正确
```

**验证码未被检测**
```
解决方案：
1. 确认插件已启用
2. 检查浏览器控制台是否有错误
3. 手动刷新页面重试
```

**绕过失败**
```
解决方案：
1. 检查API服务日志
2. 确认网站验证码类型支持
3. 尝试不同的绕过方法
```

### 调试模式

启用详细日志：

1. 打开Chrome开发者工具（F12）
2. 切换到Console标签
3. 过滤显示包含"CF Bypass"的日志
4. 重新触发验证码检测

### 重置配置

如果配置出现问题：

1. 打开插件弹窗
2. 重新输入所有配置项
3. 点击"Save Configuration"
4. 重启浏览器

## 📊 使用建议

### 学术研究最佳实践

1. **记录测试数据**：
   - 截图保存绕过过程
   - 记录成功率和耗时
   - 文档化不同网站的表现

2. **合规性检查**：
   - 仅在授权网站上测试
   - 遵守研究伦理准则
   - 避免对生产系统造成影响

3. **数据收集**：
   - 定期导出统计数据
   - 保存浏览器控制台日志
   - 记录API响应时间

### 性能优化

1. **API服务优化**：
   - 使用本地API服务减少延迟
   - 配置适当的并发限制
   - 监控API服务资源使用

2. **插件设置**：
   - 关闭不需要的重试功能
   - 调整检测间隔（修改代码）
   - 使用合适的代理设置

## 📝 配置文件示例

### 标准配置
```json
{
  "bypassEnabled": true,
  "apiEndpoint": "http://localhost:3000",
  "authToken": "",
  "bypassType": "cftoken",
  "autoDetect": true,
  "retryFailed": false,
  "useProxy": false
}
```

### 代理配置
```json
{
  "bypassEnabled": true,
  "apiEndpoint": "http://192.168.1.100:3000",
  "authToken": "your-api-token-here",
  "bypassType": "cftoken",
  "autoDetect": true,
  "retryFailed": true,
  "useProxy": true,
  "proxyHost": "127.0.0.1",
  "proxyPort": "8080"
}
```

## 🆘 获取帮助

如果您在安装或使用过程中遇到问题：

1. **检查文档**：仔细阅读 `README.md` 和 `api.md`
2. **查看日志**：检查浏览器控制台和API服务日志
3. **测试环境**：在简单的测试环境中验证功能
4. **社区支持**：联系研究团队或相关学术社区

---

**注意**：本工具仅用于学术研究目的，请确保遵守相关法律法规和伦理准则。
