// Background service worker
// 用于学术研究目的的Cloudflare验证码绕过工具

console.log('CF Bypass: Service Worker script loaded');

class CFBypassManager {
  constructor() {
    this.config = {
      bypassEnabled: false,
      apiEndpoint: 'http://localhost:3000',
      authToken: '',
      bypassType: 'cftoken',
      autoDetect: true,
      retryFailed: false,
      useProxy: false,
      proxyHost: '',
      proxyPort: ''
    };
    
    this.stats = {
      success: 0,
      failed: 0,
      total: 0
    };
    
    this.currentStatus = 'idle';
    this.activeRequests = new Map();
    
    this.init();
  }

  init() {
    console.log('CF Bypass: CFBypassManager initializing...');
    
    // 加载配置
    this.loadConfig();
    
    // 设置消息监听器
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('CF Bypass: Message listener triggered:', request.action);
      return this.handleMessage(request, sender, sendResponse);
    });

    // 监听web请求以检测验证码页面
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleWebRequest(details),
      {urls: ["<all_urls>"]},
      ["requestBody"]
    );

    // 监听响应头以检测Cloudflare
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => this.handleResponseHeaders(details),
      {urls: ["<all_urls>"]},
      ["responseHeaders"]
    );
    
    console.log('CF Bypass: CFBypassManager initialized successfully');
  }

  async loadConfig() {
    const result = await chrome.storage.sync.get(Object.keys(this.config));
    this.config = {...this.config, ...result};
  }

  async saveConfig() {
    await chrome.storage.sync.set(this.config);
  }

  handleMessage(request, sender, sendResponse) {
    console.log('CF Bypass: Background received message:', request.action);
    
    switch (request.action) {
      case 'configUpdated':
        this.config = {...this.config, ...request.config};
        this.saveConfig();
        sendResponse({success: true});
        break;
        
      case 'toggleBypass':
        this.config.bypassEnabled = request.enabled;
        this.saveConfig();
        console.log('CF Bypass: Bypass toggled:', request.enabled);
        sendResponse({success: true});
        break;
        
      case 'getStatus':
        sendResponse({
          status: this.currentStatus,
          stats: this.stats
        });
        break;
        
      case 'bypassCaptcha':
        console.log('CF Bypass: Received bypass request');
        // 异步处理，立即返回true保持通道开放
        this.handleBypassRequest(request, sender, sendResponse);
        return true; // 保持消息通道开放
        
      case 'bypassComplete':
        this.handleBypassComplete(request, sender);
        sendResponse({success: true});
        break;
        
      case 'pageLoaded':
        console.log('CF Bypass: Page loaded:', request.url);
        sendResponse({success: true});
        break;
        
      default:
        console.warn('CF Bypass: Unknown action:', request.action);
        sendResponse({error: 'Unknown action'});
    }
    
    // 对于非异步操作，不返回true
    return false;
  }

  handleWebRequest(details) {
    if (!this.config.bypassEnabled) return;
    
    // 检测可能的验证码相关请求
    const url = details.url;
    
    if (this.isCaptchaRelatedRequest(url)) {
      console.log('CF Bypass: Detected captcha request:', url);
      
      // 只有在有效tabId时才发送消息
      if (details.tabId && details.tabId >= 0) {
        try {
          chrome.tabs.sendMessage(details.tabId, {
            action: 'detectCaptcha',
            url: url
          });
        } catch (error) {
          console.error('CF Bypass: Failed to send message to tab:', error);
        }
      }
    }
  }

  handleResponseHeaders(details) {
    if (!this.config.bypassEnabled) return;
    
    const headers = details.responseHeaders || [];
    
    // 检测Cloudflare响应头
    const hasCloudflare = headers.some(header => 
      header.name.toLowerCase().includes('cf-') ||
      header.name.toLowerCase() === 'server' && 
      header.value.toLowerCase().includes('cloudflare')
    );
    
    if (hasCloudflare) {
      console.log('CF Bypass: Detected Cloudflare protection:', details.url);
      
      // 只有在有效tabId时才发送消息
      if (details.tabId && details.tabId >= 0) {
        try {
          chrome.tabs.sendMessage(details.tabId, {
            action: 'cloudflareDetected',
            url: details.url
          });
        } catch (error) {
          console.error('CF Bypass: Failed to send message to tab:', error);
        }
      }
    }
  }

  isCaptchaRelatedRequest(url) {
    const captchaKeywords = [
      'turnstile',
      'hcaptcha',
      'recaptcha',
      'captcha',
      'challenge',
      'cf-challenge'
    ];
    
    return captchaKeywords.some(keyword => 
      url.toLowerCase().includes(keyword)
    );
  }

  async handleBypassRequest(request, sender, sendResponse) {
    const {websiteUrl, websiteKey, captchaType} = request;
    const tabId = sender.tab ? sender.tab.id : null;
    
    console.log('CF Bypass: Handling bypass request:', {
      captchaType,
      websiteUrl,
      websiteKey,
      tabId
    });
    
    this.currentStatus = 'working';
    this.notifyStatusUpdate();
    
    try {
      const apiParams = {
        type: captchaType || this.config.bypassType,
        websiteUrl: websiteUrl,
        websiteKey: websiteKey,
        authToken: this.config.authToken || undefined,
        proxy: this.config.useProxy ? {
          host: this.config.proxyHost,
          port: this.config.proxyPort
        } : undefined
      };
      
      console.log('CF Bypass: Calling API with params:', apiParams);
      
      const result = await this.callBypassAPI(apiParams);
      
      console.log('CF Bypass: API response:', result);
      
      if (result.code === 200) {
        this.stats.success++;
        this.stats.total++;
        
        // 发送成功的token到content script
        if (tabId) {
          chrome.tabs.sendMessage(tabId, {
            action: 'bypassSuccess',
            token: result.token,
            cf_clearance: result.cf_clearance,
            captchaType: captchaType
          });
        }
        
        sendResponse({success: true, result: result});
      } else {
        throw new Error(result.message || 'API request failed');
      }
      
    } catch (error) {
      console.error('CF Bypass: Bypass request failed:', error);
      
      this.stats.failed++;
      this.stats.total++;
      
      // 如果启用了重试
      if (this.config.retryFailed) {
        console.log('CF Bypass: Retrying bypass request...');
        setTimeout(() => {
          this.handleBypassRequest(request, sender, sendResponse);
        }, 5000);
        return;
      }
      
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          action: 'bypassFailed',
          error: error.message
        });
      }
      
      sendResponse({success: false, error: error.message});
    } finally {
      this.currentStatus = 'idle';
      this.notifyStatusUpdate();
      this.notifyStatsUpdate();
    }
  }

  async callBypassAPI(params) {
    // 根据API文档选择正确的端点
    let endpoint;
    if (params.type === 'cfcookie') {
      // cfcookie类型使用根路径
      endpoint = `${this.config.apiEndpoint}/`;
    } else {
      // 其他类型使用/solve端点
      endpoint = `${this.config.apiEndpoint}/solve`;
    }
    
    console.log('CF Bypass: Calling bypass API:', endpoint, params);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      console.log('CF Bypass: API response status:', response.status);
      
      // 如果是404，尝试其他端点
      if (response.status === 404) {
        console.log('CF Bypass: 404 error, trying alternative endpoint...');
        
        // 尝试使用根路径
        const altEndpoint = `${this.config.apiEndpoint}/`;
        console.log('CF Bypass: Trying alternative endpoint:', altEndpoint);
        
        const altResponse = await fetch(altEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
        });
        
        console.log('CF Bypass: Alternative API response status:', altResponse.status);
        
        if (!altResponse.ok) {
          throw new Error(`API endpoints not available. Tried: ${endpoint} and ${altEndpoint}. Last status: ${altResponse.status}`);
        }
        
        const result = await altResponse.json();
        console.log('CF Bypass: Alternative API response data:', result);
        return result;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('CF Bypass: API response data:', result);
      
      return result;
    } catch (error) {
      console.error('CF Bypass: API call failed:', error);
      throw error;
    }
  }

  handleBypassComplete(request, sender) {
    // 清理活动请求
    if (this.activeRequests.has(sender.tab.id)) {
      this.activeRequests.delete(sender.tab.id);
    }
    
    console.log('Bypass completed for tab:', sender.tab.id);
  }

  notifyStatusUpdate() {
    // 通知popup状态更新
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: this.currentStatus
    });
  }

  notifyStatsUpdate() {
    // 通知popup统计信息更新
    chrome.runtime.sendMessage({
      action: 'statsUpdate',
      stats: this.stats
    });
  }
}

// 初始化管理器
console.log('CF Bypass: Creating CFBypassManager instance...');
const cfBypassManager = new CFBypassManager();
console.log('CF Bypass: CFBypassManager instance created');

// 安装和更新处理
chrome.runtime.onInstalled.addListener((details) => {
  console.log('CF Bypass Research Tool installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // 首次安装时的初始化
    chrome.storage.sync.set({
      bypassEnabled: false,
      apiEndpoint: 'http://localhost:3000',
      bypassType: 'cftoken',
      autoDetect: true
    });
  }
});