// Popup界面控制脚本
// 用于学术研究目的的Cloudflare验证码绕过工具

document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const enableBypass = document.getElementById('enableBypass');
  const apiEndpoint = document.getElementById('apiEndpoint');
  const authToken = document.getElementById('authToken');
  const bypassType = document.getElementById('bypassType');
  const autoDetect = document.getElementById('autoDetect');
  const retryFailed = document.getElementById('retryFailed');
  const useProxy = document.getElementById('useProxy');
  const proxyHost = document.getElementById('proxyHost');
  const proxyPort = document.getElementById('proxyPort');
  const saveButton = document.getElementById('saveConfig');
  const testButton = document.getElementById('testConnection');
  const statusDiv = document.getElementById('status');
  const statsDiv = document.getElementById('stats');

  // 新增的websiteKey相关元素
  const websiteKeyInput = document.getElementById('websiteKey');
  const saveKeyCheckbox = document.getElementById('saveKey');
  const useWebsiteKeyBtn = document.getElementById('useWebsiteKey');
  const manageKeysBtn = document.getElementById('manageKeys');
  const manualSubmitBtn = document.getElementById('manualSubmit');
  const currentDomainSpan = document.getElementById('currentDomain');
  const forceDetectBtn = document.getElementById('forceDetect');
  const debugPageBtn = document.getElementById('debugPage');
  
  // JS拦截控制元素
  const enableJSInterception = document.getElementById('enableJSInterception');
  const safeMode = document.getElementById('safeMode');
  const toggleHooksBtn = document.getElementById('toggleHooks');
  const refreshHooksBtn = document.getElementById('refreshHooks');

  // 加载保存的配置
  loadConfiguration();

  // 获取当前标签页信息
  getCurrentTab();

  // 绑定事件监听器
  enableBypass.addEventListener('change', toggleBypass);
  saveButton.addEventListener('click', saveConfiguration);
  testButton.addEventListener('click', testConnection);
  useProxy.addEventListener('change', toggleProxyFields);

  // 新增事件监听器
  useWebsiteKeyBtn.addEventListener('click', useWebsiteKey);
  manageKeysBtn.addEventListener('click', manageKeys);
  manualSubmitBtn.addEventListener('click', manualSubmit);
  forceDetectBtn.addEventListener('click', forceDetect);
  debugPageBtn.addEventListener('click', debugPage);
  
  // JS拦截控制事件监听器
  enableJSInterception.addEventListener('change', toggleJSInterception);
  safeMode.addEventListener('change', saveSafeModeConfig);
  toggleHooksBtn.addEventListener('click', toggleHooks);
  refreshHooksBtn.addEventListener('click', refreshHooks);

  // 定期更新状态和统计信息
  setInterval(updateStatus, 1000);

  // 加载配置
  function loadConfiguration() {
    chrome.storage.sync.get([
      'bypassEnabled',
      'apiEndpoint',
      'authToken',
      'bypassType',
      'autoDetect',
      'retryFailed',
      'useProxy',
      'proxyHost',
      'proxyPort',
      'enableJSInterception',
      'safeMode'
    ], function(result) {
      enableBypass.checked = result.bypassEnabled || false;
      apiEndpoint.value = result.apiEndpoint || 'http://localhost:3000';
      authToken.value = result.authToken || '';
      bypassType.value = result.bypassType || 'cftoken';
      autoDetect.checked = result.autoDetect !== false;
      retryFailed.checked = result.retryFailed || false;
      useProxy.checked = result.useProxy || false;
      proxyHost.value = result.proxyHost || '';
      proxyPort.value = result.proxyPort || '';
      enableJSInterception.checked = result.enableJSInterception !== false;
      safeMode.checked = result.safeMode !== false;
      
      toggleProxyFields();
      updateHooksButtonState();
    });
  }

  // 保存配置
  function saveConfiguration() {
    const config = {
      bypassEnabled: enableBypass.checked,
      apiEndpoint: apiEndpoint.value,
      authToken: authToken.value,
      bypassType: bypassType.value,
      autoDetect: autoDetect.checked,
      retryFailed: retryFailed.checked,
      useProxy: useProxy.checked,
      proxyHost: proxyHost.value,
      proxyPort: proxyPort.value,
      enableJSInterception: enableJSInterception.checked,
      safeMode: safeMode.checked
    };

    chrome.storage.sync.set(config, function() {
      // 显示保存成功提示
      const originalText = saveButton.textContent;
      saveButton.textContent = '已保存!';
      saveButton.style.backgroundColor = '#28a745';
      
      setTimeout(() => {
        saveButton.textContent = originalText;
        saveButton.style.backgroundColor = '';
      }, 2000);

      // 通知background script配置已更新
      chrome.runtime.sendMessage({
        action: 'configUpdated',
        config: config
      });
    });
  }

  // 切换绕过功能
  function toggleBypass() {
    const enabled = enableBypass.checked;
    
    chrome.runtime.sendMessage({
      action: 'toggleBypass',
      enabled: enabled
    });

    updateStatusDisplay();
  }

  // 切换代理字段显示
  function toggleProxyFields() {
    const useProxyChecked = useProxy.checked;
    proxyHost.disabled = !useProxyChecked;
    proxyPort.disabled = !useProxyChecked;
    
    if (!useProxyChecked) {
      proxyHost.style.opacity = '0.5';
      proxyPort.style.opacity = '0.5';
    } else {
      proxyHost.style.opacity = '1';
      proxyPort.style.opacity = '1';
    }
  }

  // 测试API连接
  async function testConnection() {
    const originalText = testButton.textContent;
    testButton.textContent = '测试中...';
    testButton.disabled = true;

    try {
      const endpoint = apiEndpoint.value || 'http://localhost:3000';
      const token = authToken.value;

      // 构建请求头
      const headers = {
        'Content-Type': 'application/json'
      };

      // 如果有认证token，添加到请求中
      const body = {
        type: 'test',
        authToken: token || undefined
      };

      const response = await fetch(`${endpoint}/health`, {
        method: 'GET',
        headers: headers
      });

      if (response.ok) {
        testButton.textContent = '连接成功!';
        testButton.style.backgroundColor = '#28a745';
      } else {
        testButton.textContent = '连接失败';
        testButton.style.backgroundColor = '#dc3545';
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      testButton.textContent = '连接错误';
      testButton.style.backgroundColor = '#dc3545';
    }

    setTimeout(() => {
      testButton.textContent = originalText;
      testButton.style.backgroundColor = '';
      testButton.disabled = false;
    }, 3000);
  }

  // 更新状态显示
  function updateStatus() {
    chrome.runtime.sendMessage({action: 'getStatus'}, function(response) {
      if (response) {
        updateStatusDisplay(response.status);
        updateStats(response.stats);
      }
    });
  }

  // 更新状态显示
  function updateStatusDisplay(status) {
    const isEnabled = enableBypass.checked;
    
    if (!isEnabled) {
      statusDiv.textContent = '状态: 未激活';
      statusDiv.className = 'status inactive';
    } else if (status === 'working') {
      statusDiv.textContent = '状态: 处理中...';
      statusDiv.className = 'status working';
    } else {
      statusDiv.textContent = '状态: 已激活';
      statusDiv.className = 'status active';
    }
  }

  // 更新统计信息
  function updateStats(stats) {
    if (stats) {
      const successRate = stats.total > 0 ? 
        Math.round((stats.success / stats.total) * 100) : 0;
      
      statsDiv.textContent = 
        `已绕过: ${stats.success} | 失败: ${stats.failed} | 成功率: ${successRate}%`;
    }
  }

  // 监听来自background script的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'statusUpdate') {
      updateStatusDisplay(request.status);
    } else if (request.action === 'statsUpdate') {
      updateStats(request.stats);
    }
  });

  // 获取当前标签页信息
  function getCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          const domain = url.hostname;
          currentDomainSpan.textContent = domain;
          
          // 尝试加载该域名保存的websiteKey
          loadSavedKeyForDomain(domain);
        } catch (e) {
          currentDomainSpan.textContent = '未知';
        }
      }
    });
  }

  // 加载指定域名保存的websiteKey
  function loadSavedKeyForDomain(domain) {
    chrome.storage.local.get(['cfBypassSavedKeys'], function(result) {
      const savedKeys = result.cfBypassSavedKeys || {};
      if (savedKeys[domain]) {
        websiteKeyInput.value = savedKeys[domain];
        saveKeyCheckbox.checked = true;
      }
    });
  }

  // 使用WebsiteKey
  function useWebsiteKey() {
    const websiteKey = websiteKeyInput.value.trim();
    if (!websiteKey) {
      alert('请输入有效的 WebsiteKey');
      return;
    }

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const domain = currentDomainSpan.textContent;
        
        // 保存key到localStorage（如果勾选了保存选项）
        if (saveKeyCheckbox.checked && domain !== '未知') {
          chrome.storage.local.get(['cfBypassSavedKeys'], function(result) {
            const savedKeys = result.cfBypassSavedKeys || {};
            savedKeys[domain] = websiteKey;
            chrome.storage.local.set({cfBypassSavedKeys: savedKeys});
          });
        }

        // 发送消息到content script
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'useWebsiteKey',
          websiteKey: websiteKey
        });

        // 显示成功提示
        const originalText = useWebsiteKeyBtn.textContent;
        useWebsiteKeyBtn.textContent = '✅ Key已发送';
        useWebsiteKeyBtn.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
          useWebsiteKeyBtn.textContent = originalText;
          useWebsiteKeyBtn.style.backgroundColor = '';
        }, 2000);
      }
    });
  }

  // 管理保存的keys
  function manageKeys() {
    chrome.storage.local.get(['cfBypassSavedKeys'], function(result) {
      const savedKeys = result.cfBypassSavedKeys || {};
      const domains = Object.keys(savedKeys);
      
      if (domains.length === 0) {
        alert('暂无保存的 WebsiteKey');
        return;
      }

      let message = '已保存的 WebsiteKey:\n\n';
      domains.forEach(domain => {
        const key = savedKeys[domain];
        message += `${domain}:\n${key}\n\n`;
      });

      message += '在控制台中运行 cfBypassManageKeys() 可获得更好的管理界面';
      alert(message);
    });
  }

  // 强制检测验证码
  function forceDetect() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'forceDetect'
        });

        const originalText = forceDetectBtn.textContent;
        forceDetectBtn.textContent = '🔍 检测中...';
        
        setTimeout(() => {
          forceDetectBtn.textContent = originalText;
        }, 2000);
      }
    });
  }

  // 调试当前页面
  function debugPage() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'debugPage'
        });

        const originalText = debugPageBtn.textContent;
        debugPageBtn.textContent = '🔧 调试中...';
        
        setTimeout(() => {
          debugPageBtn.textContent = originalText;
        }, 2000);
      }
    });
  }

  // 切换JavaScript Hooks
  let hooksDisabled = false;
  function toggleHooks() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const action = hooksDisabled ? 'enableHooks' : 'disableHooks';
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: action
        });

        hooksDisabled = !hooksDisabled;
        updateHooksButtonState();
      }
    });
  }

  // 切换JS拦截总开关
  function toggleJSInterception() {
    const enabled = enableJSInterception.checked;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        const action = enabled ? 'enableHooks' : 'disableHooks';
        
        chrome.tabs.sendMessage(tabs[0].id, {
          action: action
        });
        
        // 更新全局状态
        hooksDisabled = !enabled;
        updateHooksButtonState();
        
        // 保存配置
        saveConfiguration();
      }
    });
  }

  // 刷新JS Hooks
  function refreshHooks() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        // 先禁用再启用，相当于刷新
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'disableHooks'
        });
        
        setTimeout(() => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'enableHooks'
          });
          
          hooksDisabled = false;
          updateHooksButtonState();
        }, 500);
        
        const originalText = refreshHooksBtn.textContent;
        refreshHooksBtn.textContent = '🔄 刷新中...';
        refreshHooksBtn.disabled = true;
        
        setTimeout(() => {
          refreshHooksBtn.textContent = originalText;
          refreshHooksBtn.disabled = false;
        }, 2000);
      }
    });
  }

  // 更新Hooks按钮状态
  function updateHooksButtonState() {
    const jsEnabled = enableJSInterception.checked;
    
    if (!jsEnabled) {
      toggleHooksBtn.textContent = '❌ JS 钩子已禁用';
      toggleHooksBtn.style.backgroundColor = '#6c757d';
      toggleHooksBtn.disabled = true;
      refreshHooksBtn.disabled = true;
      hooksDisabled = true;
    } else {
      toggleHooksBtn.disabled = false;
      refreshHooksBtn.disabled = false;
      
      if (hooksDisabled) {
        toggleHooksBtn.textContent = '▶️ 启用 JS 钩子';
        toggleHooksBtn.style.backgroundColor = '#28a745';
      } else {
        toggleHooksBtn.textContent = '⏸️ 禁用 JS 钩子';
        toggleHooksBtn.style.backgroundColor = '#dc3545';
      }
    }
  }

  // 手动提交功能
  function manualSubmit() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'manualSubmit'
        });

        const originalText = manualSubmitBtn.textContent;
        manualSubmitBtn.textContent = '📤 提交中...';
        manualSubmitBtn.style.backgroundColor = '#007bff';
        
        setTimeout(() => {
          manualSubmitBtn.textContent = originalText;
          manualSubmitBtn.style.backgroundColor = '';
        }, 2000);
      }
    });
  }

  // 保存安全模式配置
  function saveSafeModeConfig() {
    saveConfiguration();
    
    // 通知content script更新安全模式设置
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateSafeMode',
          safeMode: safeMode.checked
        });
      }
    });
  }
});