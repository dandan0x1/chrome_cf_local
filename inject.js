// Inject script that runs in page context
// 用于学术研究目的的Cloudflare验证码绕过工具

(function() {
  'use strict';
  
  console.log('CF Bypass Research Tool: Inject script loaded');

  // 存储原始函数引用
  const originalFunctions = {};
  
  // 全局状态管理
  let hooksEnabled = true;  // hooks启用状态
  let hooksInitialized = false;  // hooks是否已初始化
  let safeMode = true;  // 安全模式，减少对验证码显示的影响

  // Hook Turnstile相关函数 - 采用更保守的策略
  function hookTurnstile() {
    if (!hooksEnabled) return;  // 检查hooks是否启用
    
    if (window.turnstile) {
      console.log('CF Bypass: Hooking Turnstile functions with conservative approach...');
      
      // Hook render函数 - 使用更安全的方法
      if (window.turnstile.render && !originalFunctions.turnstileRender) {
        originalFunctions.turnstileRender = window.turnstile.render;
        
        window.turnstile.render = function(container, params) {
          console.log('CF Bypass: Turnstile render called:', container, params);
          
          // 如果hooks被禁用，直接调用原始函数
          if (!hooksEnabled) {
            return originalFunctions.turnstileRender.apply(this, arguments);
          }
          
          // 保存原始参数
          const originalContainer = container;
          const originalParams = params;
          
          try {
            // 立即调用原始函数，确保验证码正常渲染
            const result = originalFunctions.turnstileRender.apply(this, arguments);
            
            // 异步处理我们的逻辑，避免阻塞渲染
            setTimeout(() => {
              try {
                const sitekey = originalParams?.sitekey || originalParams?.['site-key'];
                
                if (sitekey) {
                  console.log('CF Bypass: Extracted sitekey from Turnstile:', sitekey);
                  
                  // 通知content script
                  window.postMessage({
                    type: 'CF_BYPASS_TURNSTILE_RENDER',
                    container: originalContainer,
                    sitekey: sitekey,
                    params: originalParams,
                    url: window.location.href
                  }, '*');
                }
              } catch (e) {
                console.warn('CF Bypass: Error in post-render processing:', e);
              }
            }, 50);
            
            // 延迟通知渲染完成
            setTimeout(() => {
              try {
                const sitekey = originalParams?.sitekey || originalParams?.['site-key'];
                if (sitekey) {
                  window.postMessage({
                    type: 'CF_BYPASS_TURNSTILE_RENDERED',
                    container: originalContainer,
                    sitekey: sitekey,
                    widgetId: result
                  }, '*');
                }
              } catch (e) {
                console.warn('CF Bypass: Error in post-render notification:', e);
              }
            }, 500);
            
            return result;
            
          } catch (error) {
            console.error('CF Bypass: Error in Turnstile hook, falling back to original:', error);
            // 如果出错，直接调用原始函数
            return originalFunctions.turnstileRender.apply(this, arguments);
          }
        };
      }
      
      // Hook reset函数 - 更保守的方法
      if (window.turnstile.reset && !originalFunctions.turnstileReset) {
        originalFunctions.turnstileReset = window.turnstile.reset;
        
        window.turnstile.reset = function(widgetId) {
          if (!hooksEnabled) {
            return originalFunctions.turnstileReset.apply(this, arguments);
          }
          
          console.log('CF Bypass: Turnstile reset called:', widgetId);
          return originalFunctions.turnstileReset.apply(this, arguments);
        };
      }
      
      // Hook getResponse函数 - 更保守的方法
      if (window.turnstile.getResponse && !originalFunctions.turnstileGetResponse) {
        originalFunctions.turnstileGetResponse = window.turnstile.getResponse;
        
        window.turnstile.getResponse = function(widgetId) {
          const response = originalFunctions.turnstileGetResponse.apply(this, arguments);
          
          if (hooksEnabled && response) {
            console.log('CF Bypass: Turnstile getResponse called:', widgetId, response?.substring(0, 20) + '...');
          }
          
          return response;
        };
      }
    } else {
      // Turnstile对象还不存在，创建代理来监听它的创建
      if (!window.turnstileHookSetup) {
        console.log('CF Bypass: Setting up Turnstile object watcher...');
        window.turnstileHookSetup = true;
        
        Object.defineProperty(window, 'turnstile', {
          configurable: true,
          set: function(value) {
            console.log('CF Bypass: Turnstile object assigned!', value);
            this._turnstile = value;
            // 延迟hook，确保所有方法都已加载
            setTimeout(() => hookTurnstile(), 100);
          },
          get: function() {
            return this._turnstile;
          }
        });
      }
    }
  }

  // Hook hCaptcha相关函数 - 采用更保守的策略
  function hookHCaptcha() {
    if (!hooksEnabled) return;  // 检查hooks是否启用
    
    if (window.hcaptcha) {
      console.log('CF Bypass: Hooking hCaptcha functions with conservative approach...');
      
      // Hook render函数
      if (window.hcaptcha.render && !originalFunctions.hcaptchaRender) {
        originalFunctions.hcaptchaRender = window.hcaptcha.render;
        
        window.hcaptcha.render = function(container, params) {
          console.log('CF Bypass: hCaptcha render called:', container, params);
          
          // 如果hooks被禁用，直接调用原始函数
          if (!hooksEnabled) {
            return originalFunctions.hcaptchaRender.apply(this, arguments);
          }
          
          try {
            // 立即调用原始函数
            const result = originalFunctions.hcaptchaRender.apply(this, arguments);
            
            // 异步处理我们的逻辑
            setTimeout(() => {
              try {
                if (hooksEnabled) {
                  window.postMessage({
                    type: 'CF_BYPASS_HCAPTCHA_RENDER',
                    container: container,
                    params: params
                  }, '*');
                }
              } catch (e) {
                console.warn('CF Bypass: Error in hCaptcha post-render processing:', e);
              }
            }, 50);
            
            return result;
            
          } catch (error) {
            console.error('CF Bypass: Error in hCaptcha hook, falling back to original:', error);
            return originalFunctions.hcaptchaRender.apply(this, arguments);
          }
        };
      }
    }
  }

  // 监听控制台输出来捕获websiteKey
  function hookConsoleForWebsiteKey() {
    if (!hooksEnabled) return;  // 检查hooks是否启用
    
    console.log('CF Bypass: Setting up console monitoring for websiteKey...');
    
    // Hook console.log
    if (!originalFunctions.consoleLog) {
      originalFunctions.consoleLog = console.log;
      
      console.log = function(...args) {
        // 检查控制台输出中是否包含websiteKey相关信息
        const output = args.join(' ').toString();
        
        if (hooksEnabled && (output.includes('websiteKey') || 
            output.includes('sitekey') || 
            output.includes('site-key') ||
            output.includes('0x') ||
            output.includes('turnstile') ||
            output.includes('cloudflare'))) {
          
          console.info('CF Bypass: Found potential websiteKey in console:', output);
          
          // 尝试提取websiteKey
          const patterns = [
            /websiteKey['":\s]*['"]([^'"]+)['"]/gi,
            /sitekey['":\s]*['"]([^'"]+)['"]/gi,
            /site-key['":\s]*['"]([^'"]+)['"]/gi,
            /(0x[a-fA-F0-9]{20,})/gi,
            /['"]([0-9A-Za-z_-]{20,})['"].*(?:turnstile|captcha)/gi
          ];
          
          for (let pattern of patterns) {
            const matches = [...output.matchAll(pattern)];
            for (let match of matches) {
              const key = match[1];
              if (key && key.length >= 20) {
                console.info('CF Bypass: Extracted websiteKey from console:', key);
                
                window.postMessage({
                  type: 'CF_BYPASS_CONSOLE_WEBSITEKEY',
                  websiteKey: key,
                  consoleOutput: output,
                  url: window.location.href
                }, '*');
              }
            }
          }
        }
        
        return originalFunctions.consoleLog.apply(this, args);
      };
    }
    
    // Hook console.debug
    if (!originalFunctions.consoleDebug) {
      originalFunctions.consoleDebug = console.debug;
      
      console.debug = function(...args) {
        const output = args.join(' ').toString();
        
        if (output.includes('websiteKey') || output.includes('sitekey') || output.includes('0x')) {
          console.info('CF Bypass: Found websiteKey in debug:', output);
          
          const sitekeyMatch = output.match(/(?:websiteKey|sitekey)['":\s]*['"]([^'"]+)['"]/i) ||
                              output.match(/(0x[a-fA-F0-9]{20,})/);
          
          if (sitekeyMatch) {
            window.postMessage({
              type: 'CF_BYPASS_CONSOLE_WEBSITEKEY',
              websiteKey: sitekeyMatch[1],
              consoleOutput: output,
              url: window.location.href
            }, '*');
          }
        }
        
        return originalFunctions.consoleDebug.apply(this, args);
      };
    }
  }
  
  // 添加全局函数供用户手动调用
  function setupManualWebsiteKeyInput() {
    // 创建全局函数供用户在控制台调用
    window.cfBypassSetWebsiteKey = function(websiteKey) {
      console.log('CF Bypass: Manual websiteKey set:', websiteKey);
      
      window.postMessage({
        type: 'CF_BYPASS_MANUAL_WEBSITEKEY',
        websiteKey: websiteKey,
        url: window.location.href
      }, '*');
      
      return 'CF Bypass: WebsiteKey set successfully. Bypass will be triggered automatically.';
    };
    
    // 添加一个强制搜索功能
    window.cfBypassForceSearch = function() {
      console.log('CF Bypass: Force searching for captcha elements...');
      
      // 搜索所有可能的元素
      const allElements = document.querySelectorAll('*');
      const results = [];
      
      allElements.forEach((element, index) => {
        // 检查各种属性
        const hasDataSitekey = element.hasAttribute('data-sitekey') || element.hasAttribute('data-site-key');
        const className = element.className || '';
        const id = element.id || '';
        const src = element.src || '';
        const textContent = (element.textContent || '').toLowerCase();
        
        // 检查是否可能是验证码相关
        const isCaptchaRelated = 
          hasDataSitekey ||
          (typeof className === 'string' && (className.includes('captcha') || className.includes('turnstile') || className.includes('cf-'))) ||
          id.includes('captcha') || id.includes('turnstile') || id.includes('cf-') ||
          src.includes('turnstile') || src.includes('captcha') ||
          textContent.includes('verify') || textContent.includes('robot') || textContent.includes('captcha');
        
        if (isCaptchaRelated) {
          const sitekey = element.getAttribute('data-sitekey') || element.getAttribute('data-site-key');
          results.push({
            index: index,
            element: element,
            tagName: element.tagName,
            id: id,
            className: className,
            sitekey: sitekey,
            src: src,
            textContent: textContent.substring(0, 100)
          });
        }
      });
      
      console.log('CF Bypass: Force search results:', results);
      
      // 如果找到有sitekey的元素，自动触发
      for (let result of results) {
        if (result.sitekey) {
          console.log('CF Bypass: Found sitekey in force search:', result.sitekey);
          window.postMessage({
            type: 'CF_BYPASS_FORCE_DETECTED',
            sitekey: result.sitekey,
            element: result.element,
            url: window.location.href
          }, '*');
          break;
        }
      }
      
      return results.length > 0 ? 
        `Found ${results.length} potential captcha elements. Check console for details.` :
        'No captcha elements found. Try clicking on suspected areas or use cfBypassSetWebsiteKey("your-key").';
    };
    
    // 添加禁用/启用hook的功能
    window.cfBypassDisableHooks = function() {
      console.log('CF Bypass: Disabling hooks...');
      
      hooksEnabled = false;
      
      // 恢复原始函数
      if (originalFunctions.turnstileRender && window.turnstile) {
        window.turnstile.render = originalFunctions.turnstileRender;
        console.log('CF Bypass: Turnstile render hook disabled');
      }
      
      if (originalFunctions.hcaptchaRender && window.hcaptcha) {
        window.hcaptcha.render = originalFunctions.hcaptchaRender;
        console.log('CF Bypass: hCaptcha render hook disabled');
      }
      
      if (originalFunctions.grecaptchaRender && window.grecaptcha) {
        window.grecaptcha.render = originalFunctions.grecaptchaRender;
        console.log('CF Bypass: reCAPTCHA render hook disabled');
      }
      
      if (originalFunctions.grecaptchaExecute && window.grecaptcha) {
        window.grecaptcha.execute = originalFunctions.grecaptchaExecute;
        console.log('CF Bypass: reCAPTCHA execute hook disabled');
      }
      
      if (originalFunctions.consoleLog) {
        console.log = originalFunctions.consoleLog;
        console.log('CF Bypass: Console monitoring hook disabled');
      }
      
      if (originalFunctions.consoleDebug) {
        console.debug = originalFunctions.consoleDebug;
        console.log('CF Bypass: Console debug hook disabled');
      }
      
      if (originalFunctions.fetch) {
        window.fetch = originalFunctions.fetch;
        console.log('CF Bypass: Fetch hook disabled');
      }
      
      return 'CF Bypass: All hooks disabled. Captcha should work normally now.';
    };
    
    window.cfBypassEnableHooks = function() {
      console.log('CF Bypass: Re-enabling hooks...');
      
      hooksEnabled = true;
      
      // 重新初始化所有hooks
      hookTurnstile();
      hookHCaptcha();
      hookRecaptcha();
      hookConsoleForWebsiteKey();
      hookNetworkRequests();
      
      return 'CF Bypass: Hooks re-enabled.';
    };
    
    // 添加调试功能
    window.cfBypassDebugPage = function() {
      console.log('=== CF Bypass: Page Debug Information ===');
      console.log('URL:', window.location.href);
      console.log('Title:', document.title);
      console.log('ReadyState:', document.readyState);
      
      // 检查所有脚本
      const scripts = document.querySelectorAll('script');
      console.log('Scripts found:', scripts.length);
      
      scripts.forEach((script, index) => {
        const src = script.src;
        const content = script.textContent || script.innerHTML;
        
        if (src.includes('turnstile') || src.includes('captcha') || 
            content.includes('turnstile') || content.includes('captcha') || 
            content.includes('sitekey')) {
          console.log(`Script ${index}:`, {
            src: src,
            hasContent: !!content,
            contentPreview: content.substring(0, 200)
          });
        }
      });
      
      // 检查iframe
      const iframes = document.querySelectorAll('iframe');
      console.log('Iframes found:', iframes.length);
      iframes.forEach((iframe, index) => {
        console.log(`Iframe ${index}:`, {
          src: iframe.src,
          id: iframe.id,
          className: iframe.className
        });
      });
      
      return 'Debug information logged to console.';
    };
    
    // 创建带保存功能的websiteKey输入对话框
    window.cfBypassShowWebsiteKeyInput = function() {
      const existingInput = document.getElementById('cf-bypass-websitekey-input');
      if (existingInput) {
        existingInput.remove();
      }
      
      const inputContainer = document.createElement('div');
      inputContainer.id = 'cf-bypass-websitekey-input';
      inputContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #007cba;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        min-width: 400px;
        max-width: 500px;
      `;
      
      // 获取当前域名
      const currentDomain = window.location.hostname;
      
      // 从localStorage读取已保存的sitekeys
      const savedKeys = JSON.parse(localStorage.getItem('cfBypassSavedKeys') || '{}');
      const savedKeyForDomain = savedKeys[currentDomain] || '';
      
      inputContainer.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 16px; color: #007cba; flex: 1;">
            🔑 CF Bypass - WebsiteKey 管理
          </div>
          <button id="cf-close-input" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
        </div>
        
        <div style="margin-bottom: 10px; font-size: 14px; color: #666;">
          当前网站: <strong>${currentDomain}</strong>
        </div>
        
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-weight: 500;">WebsiteKey:</label>
          <input type="text" id="cf-websitekey-field" placeholder="输入 websiteKey (例如: 0x4AAA...)" 
                 value="${savedKeyForDomain}"
                 style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: flex; align-items: center; font-size: 14px; cursor: pointer;">
            <input type="checkbox" id="cf-save-key" ${savedKeyForDomain ? 'checked' : ''} 
                   style="margin-right: 8px;" />
            为此网站保存 WebsiteKey
          </label>
        </div>
        
        <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 6px; font-size: 12px; color: #666;">
          💡 <strong>提示:</strong><br>
          • 保存的 key 将存储在本地，下次访问时自动填入<br>
          • 可以在页面源码中搜索 "sitekey" 或 "0x" 找到<br>
          • Turnstile key 通常以 "0x" 开头
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
          <button id="cf-submit-key" style="flex: 1; padding: 12px; background: #007cba; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
            🚀 开始绕过
          </button>
          <button id="cf-auto-detect" style="flex: 1; padding: 12px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
            🔍 自动检测
          </button>
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button id="cf-manage-keys" style="flex: 1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
            📋 管理保存的Key
          </button>
          <button id="cf-clear-domain" style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">
            🗑️ 清除此域名
          </button>
        </div>
      `;
      
      document.body.appendChild(inputContainer);
      
      // 事件监听
      document.getElementById('cf-submit-key').onclick = function() {
        const websiteKey = document.getElementById('cf-websitekey-field').value.trim();
        const shouldSave = document.getElementById('cf-save-key').checked;
        
        if (websiteKey) {
          // 保存key
          if (shouldSave) {
            const savedKeys = JSON.parse(localStorage.getItem('cfBypassSavedKeys') || '{}');
            savedKeys[currentDomain] = websiteKey;
            localStorage.setItem('cfBypassSavedKeys', JSON.stringify(savedKeys));
            console.log('CF Bypass: WebsiteKey saved for', currentDomain);
          }
          
          window.cfBypassSetWebsiteKey(websiteKey);
          inputContainer.remove();
        } else {
          alert('请输入有效的 websiteKey');
        }
      };
      
      document.getElementById('cf-auto-detect').onclick = function() {
        inputContainer.remove();
        window.cfBypassForceSearch();
      };
      
      document.getElementById('cf-manage-keys').onclick = function() {
        window.cfBypassManageKeys();
      };
      
      document.getElementById('cf-clear-domain').onclick = function() {
        const savedKeys = JSON.parse(localStorage.getItem('cfBypassSavedKeys') || '{}');
        delete savedKeys[currentDomain];
        localStorage.setItem('cfBypassSavedKeys', JSON.stringify(savedKeys));
        document.getElementById('cf-websitekey-field').value = '';
        document.getElementById('cf-save-key').checked = false;
        console.log('CF Bypass: Cleared saved key for', currentDomain);
      };
      
      document.getElementById('cf-close-input').onclick = function() {
        inputContainer.remove();
      };
      
      // ESC键关闭
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('cf-bypass-websitekey-input')) {
          inputContainer.remove();
        }
      });
      
      // 自动聚焦输入框
      document.getElementById('cf-websitekey-field').focus();
      
      return 'WebsiteKey input dialog opened with save functionality.';
    };
    
    // 管理已保存的keys
    window.cfBypassManageKeys = function() {
      const savedKeys = JSON.parse(localStorage.getItem('cfBypassSavedKeys') || '{}');
      const domains = Object.keys(savedKeys);
      
      if (domains.length === 0) {
        alert('暂无保存的 WebsiteKey');
        return;
      }
      
      const existingManager = document.getElementById('cf-bypass-key-manager');
      if (existingManager) {
        existingManager.remove();
      }
      
      const managerContainer = document.createElement('div');
      managerContainer.id = 'cf-bypass-key-manager';
      managerContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #007cba;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        min-width: 500px;
        max-width: 600px;
        max-height: 70vh;
        overflow-y: auto;
      `;
      
      let keysList = '';
      domains.forEach(domain => {
        const key = savedKeys[domain];
        const isCurrentDomain = domain === window.location.hostname;
        keysList += `
          <div style="display: flex; align-items: center; padding: 10px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 8px; ${isCurrentDomain ? 'background: #e3f2fd;' : ''}">
            <div style="flex: 1;">
              <div style="font-weight: 500; color: #333; ${isCurrentDomain ? 'color: #007cba;' : ''}">${domain} ${isCurrentDomain ? '(当前)' : ''}</div>
              <div style="font-size: 12px; color: #666; font-family: monospace;">${key}</div>
            </div>
            <button onclick="window.cfBypassUseKey('${domain}', '${key}')" style="padding: 5px 10px; margin-right: 5px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">使用</button>
            <button onclick="window.cfBypassDeleteKey('${domain}')" style="padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">删除</button>
          </div>
        `;
      });
      
      managerContainer.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 15px;">
          <div style="font-weight: bold; font-size: 16px; color: #007cba; flex: 1;">
            📋 已保存的 WebsiteKey
          </div>
          <button onclick="document.getElementById('cf-bypass-key-manager').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
        </div>
        
        <div style="margin-bottom: 15px;">
          ${keysList}
        </div>
        
        <div style="display: flex; gap: 10px;">
          <button onclick="window.cfBypassClearAllKeys()" style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">
            🗑️ 清除所有Key
          </button>
          <button onclick="document.getElementById('cf-bypass-key-manager').remove()" style="flex: 1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">
            关闭
          </button>
        </div>
      `;
      
      document.body.appendChild(managerContainer);
      
      return `Found ${domains.length} saved keys.`;
    };
    
    // 使用指定的key
    window.cfBypassUseKey = function(domain, key) {
      console.log(`CF Bypass: Using saved key for ${domain}:`, key);
      window.cfBypassSetWebsiteKey(key);
      document.getElementById('cf-bypass-key-manager').remove();
    };
    
    // 删除指定域名的key
    window.cfBypassDeleteKey = function(domain) {
      if (confirm(`确定要删除 ${domain} 的 WebsiteKey 吗？`)) {
        const savedKeys = JSON.parse(localStorage.getItem('cfBypassSavedKeys') || '{}');
        delete savedKeys[domain];
        localStorage.setItem('cfBypassSavedKeys', JSON.stringify(savedKeys));
        console.log('CF Bypass: Deleted key for', domain);
        // 刷新管理界面
        document.getElementById('cf-bypass-key-manager').remove();
        window.cfBypassManageKeys();
      }
    };
    
    // 清除所有keys
    window.cfBypassClearAllKeys = function() {
      if (confirm('确定要清除所有保存的 WebsiteKey 吗？此操作不可撤销！')) {
        localStorage.removeItem('cfBypassSavedKeys');
        console.log('CF Bypass: All saved keys cleared');
        document.getElementById('cf-bypass-key-manager').remove();
        alert('所有保存的 WebsiteKey 已清除');
      }
    };
    
    // 自动加载当前域名的saved key
    window.cfBypassAutoLoadKey = function() {
      const currentDomain = window.location.hostname;
      const savedKeys = JSON.parse(localStorage.getItem('cfBypassSavedKeys') || '{}');
      const savedKey = savedKeys[currentDomain];
      
      if (savedKey) {
        console.log(`CF Bypass: Auto-loading saved key for ${currentDomain}:`, savedKey);
        setTimeout(() => {
          window.cfBypassSetWebsiteKey(savedKey);
        }, 2000); // 延迟2秒自动加载
        return true;
      }
      return false;
    };
    
    console.log('CF Bypass: Manual control functions available:');
    console.log('- cfBypassSetWebsiteKey("your-websitekey") - Set websiteKey manually');
    console.log('- cfBypassShowWebsiteKeyInput() - Show advanced input dialog with save');
    console.log('- cfBypassManageKeys() - Manage saved websiteKeys');
    console.log('- cfBypassAutoLoadKey() - Auto-load saved key for current domain');
    console.log('- cfBypassForceSearch() - Force search for captcha elements');
    console.log('- cfBypassDebugPage() - Debug page information');
    console.log('- cfBypassDisableHooks() - Disable JavaScript hooks');
    console.log('- cfBypassEnableHooks() - Re-enable JavaScript hooks');
    
    // 自动尝试加载保存的key
    setTimeout(() => {
      const autoLoaded = window.cfBypassAutoLoadKey();
      if (autoLoaded) {
        console.log('CF Bypass: Auto-loaded saved websiteKey for this domain');
      }
    }, 3000);
  }
  
  // 监听用户点击行为来检测验证码
  function monitorUserClicks() {
    console.log('CF Bypass: Setting up user click monitoring...');
    
    // 监听所有点击事件
    document.addEventListener('click', function(event) {
      const target = event.target;
      const clickedElement = target.closest ? target.closest('*') : target;
      
      console.log('CF Bypass: Click detected on:', clickedElement);
      
      // 检查点击的元素是否与验证码相关
      if (isClickOnCaptcha(clickedElement, event)) {
        console.log('CF Bypass: User clicked on captcha element!');
        
        // 延迟检测，给验证码时间加载
        setTimeout(() => {
          detectCaptchaFromClick(clickedElement, event);
        }, 500);
        
        setTimeout(() => {
          detectCaptchaFromClick(clickedElement, event);
        }, 2000);
        
        setTimeout(() => {
          detectCaptchaFromClick(clickedElement, event);
        }, 5000);
      }
    }, true); // 使用捕获阶段来更早地捕获事件
    
    // 监听焦点事件（有些验证码通过焦点触发）
    document.addEventListener('focus', function(event) {
      const target = event.target;
      
      if (isClickOnCaptcha(target, event)) {
        console.log('CF Bypass: User focused on captcha element!');
        setTimeout(() => {
          detectCaptchaFromClick(target, event);
        }, 1000);
      }
    }, true);
  }
  
  // 判断点击是否在验证码相关元素上
  function isClickOnCaptcha(element, event) {
    if (!element) return false;
    
    // 检查元素及其父元素
    let currentElement = element;
    for (let i = 0; i < 10 && currentElement; i++) {
      
      // 检查类名
      const className = currentElement.className || '';
      const classStr = (typeof className === 'string') ? className : 
                      (className.toString) ? className.toString() : '';
      
      if (classStr.includes('turnstile') || 
          classStr.includes('captcha') || 
          classStr.includes('challenge') ||
          classStr.includes('cf-') ||
          classStr.includes('cloudflare')) {
        console.log('CF Bypass: Found captcha-related class:', classStr);
        return true;
      }
      
      // 检查ID
      const id = currentElement.id || '';
      if (id.includes('turnstile') || 
          id.includes('captcha') || 
          id.includes('challenge') ||
          id.includes('cf-')) {
        console.log('CF Bypass: Found captcha-related ID:', id);
        return true;
      }
      
      // 检查data属性
      if (currentElement.hasAttribute && 
          (currentElement.hasAttribute('data-sitekey') ||
           currentElement.hasAttribute('data-site-key') ||
           currentElement.hasAttribute('data-callback'))) {
        console.log('CF Bypass: Found captcha data attribute');
        return true;
      }
      
      // 检查iframe (很多验证码在iframe中)
      if (currentElement.tagName === 'IFRAME') {
        const src = currentElement.src || '';
        if (src.includes('turnstile') || 
            src.includes('captcha') || 
            src.includes('challenge') ||
            src.includes('cloudflare')) {
          console.log('CF Bypass: Found captcha iframe:', src);
          return true;
        }
      }
      
      // 检查文本内容
      const textContent = currentElement.textContent || '';
      if (textContent.toLowerCase().includes('verify') ||
          textContent.toLowerCase().includes('robot') ||
          textContent.toLowerCase().includes('human') ||
          textContent.toLowerCase().includes('captcha')) {
        console.log('CF Bypass: Found captcha-related text:', textContent.substring(0, 50));
        return true;
      }
      
      // 向上查找父元素
      currentElement = currentElement.parentElement;
    }
    
    // 检查点击坐标附近是否有验证码元素
    if (event && event.clientX && event.clientY) {
      const elementsAtPoint = document.elementsFromPoint(event.clientX, event.clientY);
      for (let elem of elementsAtPoint) {
        if (elem && elem.className) {
          const classStr = (typeof elem.className === 'string') ? elem.className : 
                          (elem.className.toString) ? elem.className.toString() : '';
          if (classStr.includes('turnstile') || classStr.includes('captcha')) {
            console.log('CF Bypass: Found captcha element at click point');
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // 从点击位置检测验证码
  function detectCaptchaFromClick(clickedElement, event) {
    console.log('CF Bypass: Analyzing clicked element for captcha...');
    
    // 方法1: 直接检查点击的元素及其周围
    let searchElements = [clickedElement];
    
    // 添加父元素
    let parent = clickedElement.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      searchElements.push(parent);
      parent = parent.parentElement;
    }
    
    // 添加子元素
    if (clickedElement.children) {
      for (let child of clickedElement.children) {
        searchElements.push(child);
      }
    }
    
    // 添加兄弟元素
    if (clickedElement.parentElement && clickedElement.parentElement.children) {
      for (let sibling of clickedElement.parentElement.children) {
        searchElements.push(sibling);
      }
    }
    
    // 检查所有相关元素
    for (let element of searchElements) {
      const sitekey = extractSitekeyFromElement(element);
      if (sitekey) {
        console.log('CF Bypass: Found sitekey from clicked element:', sitekey);
        
        window.postMessage({
          type: 'CF_BYPASS_CLICK_DETECTED',
          sitekey: sitekey,
          clickedElement: element,
          clickPosition: event ? { x: event.clientX, y: event.clientY } : null,
          url: window.location.href
        }, '*');
        
        return;
      }
    }
    
    // 方法2: 在页面中搜索最近添加的验证码元素
    setTimeout(() => {
      const allCaptchaElements = document.querySelectorAll([
        '.cf-turnstile',
        '[data-sitekey]',
        '[data-site-key]',
        '.h-captcha',
        '.g-recaptcha',
        'iframe[src*="turnstile"]',
        'iframe[src*="captcha"]'
      ].join(','));
      
      for (let element of allCaptchaElements) {
        const sitekey = extractSitekeyFromElement(element);
        if (sitekey) {
          console.log('CF Bypass: Found sitekey after click delay:', sitekey);
          
          window.postMessage({
            type: 'CF_BYPASS_CLICK_DETECTED',
            sitekey: sitekey,
            clickedElement: element,
            clickPosition: event ? { x: event.clientX, y: event.clientY } : null,
            url: window.location.href
          }, '*');
          
          break;
        }
      }
    }, 3000);
  }
  
  // 从元素中提取sitekey
  function extractSitekeyFromElement(element) {
    if (!element) return null;
    
    // 直接检查data属性
    let sitekey = element.getAttribute ? 
                 (element.getAttribute('data-sitekey') || element.getAttribute('data-site-key')) : 
                 null;
    
    if (sitekey) return sitekey;
    
    // 检查子元素
    if (element.querySelector) {
      const childWithSitekey = element.querySelector('[data-sitekey], [data-site-key]');
      if (childWithSitekey) {
        sitekey = childWithSitekey.getAttribute('data-sitekey') || 
                 childWithSitekey.getAttribute('data-site-key');
        if (sitekey) return sitekey;
      }
    }
    
    // 检查iframe src
    if (element.tagName === 'IFRAME' && element.src) {
      const sitekeyMatch = element.src.match(/\/0x([a-fA-F0-9]+)\//);
      if (sitekeyMatch) {
        return '0x' + sitekeyMatch[1];
      }
    }
    
    // 检查脚本内容
    if (element.tagName === 'SCRIPT') {
      const content = element.textContent || element.innerHTML;
      if (content) {
        const patterns = [
          /sitekey['"\s]*[:=]['"\s]*([a-zA-Z0-9_-]+)/gi,
          /(0x[a-fA-F0-9]{20,})/gi
        ];
        
        for (let pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1] && match[1].length >= 20) {
            return match[1];
          }
        }
      }
    }
    
    return null;
  }
  
  // 监听Cloudflare beacon脚本和动态重定向
  function monitorCloudflareBeacon() {
    console.log('CF Bypass: Setting up Cloudflare beacon monitoring...');
    
    // 监听所有script标签的加载
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
            const src = node.src || '';
            const content = node.textContent || node.innerHTML || '';
            
            // 检测Cloudflare beacon脚本
            if (src.includes('cloudflareinsights.com/beacon') || 
                src.includes('static.cloudflareinsights.com')) {
              console.log('CF Bypass: Detected Cloudflare beacon script:', src);
              
              // 提取data-cf-beacon属性
              const beaconData = node.getAttribute('data-cf-beacon');
              if (beaconData) {
                console.log('CF Bypass: Beacon data:', beaconData);
                try {
                  const beaconInfo = JSON.parse(beaconData);
                  if (beaconInfo.token) {
                    console.log('CF Bypass: Found beacon token:', beaconInfo.token);
                    
                    // 通知content script发现了beacon
                    window.postMessage({
                      type: 'CF_BYPASS_BEACON_DETECTED',
                      beaconData: beaconInfo,
                      scriptSrc: src,
                      url: window.location.href
                    }, '*');
                  }
                } catch (e) {
                  console.log('CF Bypass: Could not parse beacon data:', e);
                }
              }
            }
            
            // 检测challenges.cloudflare.com重定向
            if (src.includes('challenges.cloudflare.com')) {
              console.log('CF Bypass: Detected Cloudflare challenge redirect:', src);
              
              // 从URL中提取sitekey
              const sitekeyMatch = src.match(/\/0x([a-fA-F0-9]+)\//);
              if (sitekeyMatch) {
                const sitekey = '0x' + sitekeyMatch[1];
                console.log('CF Bypass: Extracted sitekey from challenge URL:', sitekey);
                
                window.postMessage({
                  type: 'CF_BYPASS_CHALLENGE_REDIRECT',
                  sitekey: sitekey,
                  challengeUrl: src,
                  url: window.location.href
                }, '*');
              }
            }
          }
        });
      });
    });
    
    observer.observe(document.head || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-cf-beacon']
    });
    
    // 检查已存在的beacon脚本
    const existingBeacons = document.querySelectorAll('script[data-cf-beacon]');
    existingBeacons.forEach(script => {
      const beaconData = script.getAttribute('data-cf-beacon');
      const src = script.src;
      
      console.log('CF Bypass: Found existing beacon script:', src, beaconData);
      
      if (beaconData) {
        try {
          const beaconInfo = JSON.parse(beaconData);
          window.postMessage({
            type: 'CF_BYPASS_BEACON_DETECTED',
            beaconData: beaconInfo,
            scriptSrc: src,
            url: window.location.href
          }, '*');
        } catch (e) {
          console.log('CF Bypass: Could not parse existing beacon data:', e);
        }
      }
    });
  }
  
  // Hook网络请求来监听动态加载
  function hookNetworkRequests() {
    console.log('CF Bypass: Setting up network request monitoring...');
    
    // Hook fetch
    if (window.fetch && !originalFunctions.fetch) {
      originalFunctions.fetch = window.fetch;
      
      window.fetch = function(...args) {
        const url = args[0];
        if (typeof url === 'string') {
          // 检测Cloudflare相关请求
          if (url.includes('challenges.cloudflare.com') || 
              url.includes('turnstile') || 
              url.includes('captcha')) {
            console.log('CF Bypass: Intercepted fetch request:', url);
            
            // 提取sitekey
            const sitekeyMatch = url.match(/\/0x([a-fA-F0-9]+)\//);
            if (sitekeyMatch) {
              const sitekey = '0x' + sitekeyMatch[1];
              window.postMessage({
                type: 'CF_BYPASS_NETWORK_SITEKEY',
                sitekey: sitekey,
                requestUrl: url,
                url: window.location.href
              }, '*');
            }
          }
        }
        
        return originalFunctions.fetch.apply(this, args);
      };
    }
    
    // Hook XMLHttpRequest
    if (window.XMLHttpRequest && !originalFunctions.XMLHttpRequest) {
      originalFunctions.XMLHttpRequest = window.XMLHttpRequest;
      
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === 'string' && 
            (url.includes('challenges.cloudflare.com') || 
             url.includes('turnstile') || 
             url.includes('captcha'))) {
          console.log('CF Bypass: Intercepted XHR request:', method, url);
          
          const sitekeyMatch = url.match(/\/0x([a-fA-F0-9]+)\//);
          if (sitekeyMatch) {
            const sitekey = '0x' + sitekeyMatch[1];
            window.postMessage({
              type: 'CF_BYPASS_NETWORK_SITEKEY',
              sitekey: sitekey,
              requestUrl: url,
              url: window.location.href
            }, '*');
          }
        }
        
        return originalOpen.apply(this, arguments);
      };
    }
  }
  
  // Hook reCAPTCHA相关函数
  function hookRecaptcha() {
    if (window.grecaptcha) {
      console.log('Hooking reCAPTCHA functions...');
      
      // Hook render函数
      if (window.grecaptcha.render && !originalFunctions.grecaptchaRender) {
        originalFunctions.grecaptchaRender = window.grecaptcha.render;
        
        window.grecaptcha.render = function(container, params) {
          console.log('reCAPTCHA render called:', container, params);
          
          // 立即调用原始函数
          const result = originalFunctions.grecaptchaRender.call(this, container, params);
          
          // 然后通知content script
          window.postMessage({
            type: 'CF_BYPASS_RECAPTCHA_RENDER',
            container: container,
            params: params
          }, '*');
          
          return result;
        };
      }
      
      // Hook execute函数 (v3)
      if (window.grecaptcha.execute && !originalFunctions.grecaptchaExecute) {
        originalFunctions.grecaptchaExecute = window.grecaptcha.execute;
        
        window.grecaptcha.execute = function(sitekey, options) {
          console.log('reCAPTCHA execute called:', sitekey, options);
          
          // 先通知content script
          window.postMessage({
            type: 'CF_BYPASS_RECAPTCHA_EXECUTE',
            sitekey: sitekey,
            options: options
          }, '*');
          
          // 立即调用原始函数
          return originalFunctions.grecaptchaExecute.call(this, sitekey, options);
        };
      }
    }
  }

  // 监听来自content script的消息
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    const {type, data} = event.data;
    
    switch (type) {
      case 'CF_BYPASS_INJECT_TOKEN':
        injectToken(data);
        break;
        
      case 'CF_BYPASS_TRIGGER_CALLBACK':
        triggerCallback(data);
        break;
        
      case 'CF_BYPASS_SIMULATE_SUCCESS':
        simulateSuccess(data);
        break;
        
      case 'CF_BYPASS_RUN_DEBUG':
        window.cfBypassDebugPage();
        break;
        
      case 'CF_BYPASS_DISABLE_HOOKS':
        window.cfBypassDisableHooks();
        break;
        
      case 'CF_BYPASS_ENABLE_HOOKS':
        window.cfBypassEnableHooks();
        break;
        
      case 'CF_BYPASS_UPDATE_SAFE_MODE':
        safeMode = event.data.safeMode;
        console.log('CF Bypass: Safe mode updated to:', safeMode);
        break;
        
      case 'CF_BYPASS_MANUAL_SUBMIT':
        console.log('CF Bypass: Manual submit triggered');
        manualSubmitForms();
        break;
    }
  });

  // 手动提交表单功能
  function manualSubmitForms() {
    console.log('CF Bypass: Looking for forms to manually submit...');
    
    const forms = document.querySelectorAll('form');
    let formsSubmitted = 0;
    
    forms.forEach((form, index) => {
      const hasResponseField = form.querySelector(
        'input[name*="turnstile"], input[name*="captcha"], input[name*="response"], ' +
        'textarea[name*="turnstile"], textarea[name*="captcha"], textarea[name*="response"]'
      );
      const hasCaptchaElement = form.querySelector('.cf-turnstile, .h-captcha, .g-recaptcha, [data-sitekey]');
      
      if (hasResponseField || hasCaptchaElement) {
        console.log(`CF Bypass: Manually submitting form ${index}`);
        formsSubmitted++;
        
        // 查找提交按钮
        const submitButtons = form.querySelectorAll(
          'button[type="submit"], input[type="submit"], button:not([type]), ' +
          'button[class*="submit"], button[class*="login"], button[class*="signin"], ' +
          'button[class*="continue"], button[class*="next"]'
        );
        
        let buttonClicked = false;
        submitButtons.forEach(button => {
          if (!button.disabled && !buttonClicked) {
            console.log('CF Bypass: Clicking submit button:', button);
            button.click();
            buttonClicked = true;
          }
        });
        
        // 如果没有找到按钮，直接提交表单
        if (!buttonClicked) {
          console.log('CF Bypass: No submit button found, submitting form directly');
          try {
            form.submit();
          } catch (e) {
            console.warn('CF Bypass: Error submitting form:', e);
          }
        }
      }
    });
    
    console.log(`CF Bypass: Manually submitted ${formsSubmitted} forms`);
    
    // 如果没有找到相关表单，查找独立的提交按钮
    if (formsSubmitted === 0) {
      console.log('CF Bypass: No forms found, looking for standalone submit buttons...');
      const buttons = document.querySelectorAll(
        'button[class*="submit"], button[class*="login"], button[class*="signin"], ' +
        'button[class*="continue"], button[class*="next"], [role="button"][class*="submit"]'
      );
      
      buttons.forEach((button, index) => {
        if (!button.disabled) {
          console.log(`CF Bypass: Clicking standalone button ${index}:`, button);
          setTimeout(() => {
            button.click();
          }, index * 200); // 延迟点击，避免同时点击多个按钮
        }
      });
    }
  }
  function injectToken(data) {
    const {token, captchaType, widgetId} = data;
    
    console.log(`Injecting ${captchaType} token:`, token.substring(0, 20) + '...');
    
    switch (captchaType) {
      case 'cftoken':
        injectTurnstileToken(token, widgetId);
        break;
      case 'hcaptcha':
        injectHCaptchaToken(token, widgetId);
        break;
      case 'recaptchav2':
        injectRecaptchaV2Token(token, widgetId);
        break;
      case 'recaptchav3':
        injectRecaptchaV3Token(token);
        break;
    }
  }

  function injectTurnstileToken(token, widgetId) {
    console.log('CF Bypass: Injecting Turnstile token (page level):', token.substring(0, 20) + '...');
    
    try {
      let tokenApplied = false;
      
      // 方法1: 设置隐藏的响应字段
      const responseInputs = document.querySelectorAll('input[name="cf-turnstile-response"]');
      const responseTextareas = document.querySelectorAll('textarea[name="cf-turnstile-response"]');
      
      [...responseInputs, ...responseTextareas].forEach((field, index) => {
        console.log(`CF Bypass: Setting response field ${index}:`, field);
        field.value = token;
        field.dispatchEvent(new Event('change', {bubbles: true}));
        field.dispatchEvent(new Event('input', {bubbles: true}));
        tokenApplied = true;
      });
      
      // 方法2: 查找并触发callback函数
      const turnstileContainers = document.querySelectorAll('.cf-turnstile, [data-sitekey*="0x"]');
      turnstileContainers.forEach((container, index) => {
        const callback = container.getAttribute('data-callback');
        if (callback && window[callback]) {
          console.log(`CF Bypass: Triggering callback ${callback} for container ${index}`);
          try {
            window[callback](token);
            tokenApplied = true;
          } catch (e) {
            console.warn('CF Bypass: Error calling callback:', e);
          }
        }
      });
      
      // 方法3: 如果有widgetId，尝试使用Turnstile API
      if (widgetId && window.turnstile) {
        try {
          console.log('CF Bypass: Attempting Turnstile API methods...');
          
          // 尝试直接设置响应
          if (window.turnstile.getResponse) {
            const originalGetResponse = window.turnstile.getResponse;
            window.turnstile.getResponse = function(id) {
              if (id === widgetId || arguments.length === 0) {
                console.log('CF Bypass: Returning injected token via getResponse');
                return token;
              }
              return originalGetResponse.apply(this, arguments);
            };
            tokenApplied = true;
          }
          
          // 触发成功事件
          const successEvent = new CustomEvent('cf-turnstile-callback', {
            detail: { token: token, widgetId: widgetId }
          });
          window.dispatchEvent(successEvent);
          
          // 也尝试全局事件
          const globalEvent = new CustomEvent('turnstile-success', {
            detail: { token: token, widgetId: widgetId }
          });
          document.dispatchEvent(globalEvent);
          
        } catch (e) {
          console.log('CF Bypass: Could not use Turnstile API:', e);
        }
      }
      
      // 方法4: 查找表单并自动提交
      setTimeout(() => {
        findAndSubmitCaptchaForms(token);
      }, 100);
      
      // 方法5: 设置全局变量供网站使用
      window.cfBypassToken = token;
      window.turnstileToken = token;
      
      // 方法6: 尝试更新所有可能的响应字段
      setTimeout(() => {
        updateAllResponseFields(token);
      }, 200);
      
      console.log('CF Bypass: Turnstile token injection completed, applied:', tokenApplied);
      
    } catch (error) {
      console.error('CF Bypass: Failed to inject Turnstile token:', error);
    }
  }

  // 查找并提交验证码表单
  function findAndSubmitCaptchaForms(token) {
    console.log('CF Bypass: Looking for captcha forms to submit...');
    
    const forms = document.querySelectorAll('form');
    forms.forEach((form, index) => {
      const hasResponseField = form.querySelector('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
      const hasTurnstile = form.querySelector('.cf-turnstile, [data-sitekey]');
      
      if (hasResponseField || hasTurnstile) {
        console.log(`CF Bypass: Found captcha form ${index}, preparing submission...`);
        
        // 确保响应字段有值
        const responseFields = form.querySelectorAll('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
        responseFields.forEach(field => {
          if (!field.value) {
            field.value = token;
            field.dispatchEvent(new Event('change', {bubbles: true}));
          }
        });
        
        // 触发表单事件
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
        
        // 查找提交按钮
        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
        if (submitBtn && !submitBtn.disabled) {
          console.log(`CF Bypass: Clicking submit button for form ${index}`);
          setTimeout(() => {
            submitBtn.click();
          }, 300);
        }
      }
    });
  }

  // 更新所有可能的响应字段
  function updateAllResponseFields(token) {
    const allResponseFields = document.querySelectorAll(
      'input[name*="turnstile"], input[name*="captcha"], input[name*="response"], ' +
      'textarea[name*="turnstile"], textarea[name*="captcha"], textarea[name*="response"], ' +
      'input[id*="turnstile"], input[id*="captcha"], input[id*="response"], ' +
      'textarea[id*="turnstile"], textarea[id*="captcha"], textarea[id*="response"]'
    );
    
    allResponseFields.forEach((field, index) => {
      if (field.type === 'hidden' || field.style.display === 'none' || field.offsetParent === null) {
        console.log(`CF Bypass: Updating response field ${index}:`, field.name || field.id);
        field.value = token;
        field.dispatchEvent(new Event('change', {bubbles: true}));
      }
    });
  }

  function injectHCaptchaToken(token, widgetId) {
    if (window.hcaptcha) {
      try {
        // 设置响应字段
        const responseTextareas = document.querySelectorAll('textarea[name="h-captcha-response"]');
        responseTextareas.forEach(textarea => {
          textarea.value = token;
          textarea.dispatchEvent(new Event('change', {bubbles: true}));
        });
        
        // 触发成功回调
        const hcaptchaContainers = document.querySelectorAll('.h-captcha');
        hcaptchaContainers.forEach(container => {
          const callback = container.getAttribute('data-callback');
          if (callback && window[callback]) {
            window[callback](token);
          }
        });
        
      } catch (error) {
        console.error('Failed to inject hCaptcha token:', error);
      }
    }
  }

  function injectRecaptchaV2Token(token, widgetId) {
    if (window.grecaptcha) {
      try {
        // 设置响应字段
        const responseTextareas = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
        responseTextareas.forEach(textarea => {
          textarea.value = token;
          textarea.dispatchEvent(new Event('change', {bubbles: true}));
        });
        
        // 触发成功回调
        const recaptchaContainers = document.querySelectorAll('.g-recaptcha');
        recaptchaContainers.forEach(container => {
          const callback = container.getAttribute('data-callback');
          if (callback && window[callback]) {
            window[callback](token);
          }
        });
        
      } catch (error) {
        console.error('Failed to inject reCAPTCHA v2 token:', error);
      }
    }
  }

  function injectRecaptchaV3Token(token) {
    // reCAPTCHA v3 token通常通过Promise返回
    try {
      // 存储token供后续使用
      window.cfBypassRecaptchaV3Token = token;
      
      // 查找并调用可能的回调
      if (window.recaptchaV3Callback) {
        window.recaptchaV3Callback(token);
      }
      
      // 触发自定义事件
      window.dispatchEvent(new CustomEvent('cfBypassRecaptchaV3Token', {
        detail: {token: token}
      }));
      
    } catch (error) {
      console.error('Failed to inject reCAPTCHA v3 token:', error);
    }
  }

  function triggerCallback(data) {
    const {callbackName, token} = data;
    
    if (window[callbackName] && typeof window[callbackName] === 'function') {
      try {
        window[callbackName](token);
        console.log(`Triggered callback: ${callbackName}`);
      } catch (error) {
        console.error(`Failed to trigger callback ${callbackName}:`, error);
      }
    }
  }

  function simulateSuccess(data) {
    const {captchaType, token} = data;
    
    // 模拟验证码成功完成
    switch (captchaType) {
      case 'cftoken':
        simulateTurnstileSuccess(token);
        break;
      case 'hcaptcha':
        simulateHCaptchaSuccess(token);
        break;
      case 'recaptchav2':
        simulateRecaptchaV2Success(token);
        break;
    }
  }

  function simulateTurnstileSuccess(token) {
    // 模拟Turnstile成功验证
    const event = new CustomEvent('cf-turnstile-success', {
      detail: {token: token}
    });
    window.dispatchEvent(event);
  }

  function simulateHCaptchaSuccess(token) {
    // 模拟hCaptcha成功验证
    const event = new CustomEvent('hcaptcha-success', {
      detail: {token: token}
    });
    window.dispatchEvent(event);
  }

  function simulateRecaptchaV2Success(token) {
    // 模拟reCAPTCHA v2成功验证
    const event = new CustomEvent('recaptcha-success', {
      detail: {token: token}
    });
    window.dispatchEvent(event);
  }

  // 初始化hooks
  function initHooks() {
    console.log('CF Bypass: Initializing JavaScript hooks...');
    
    if (!hooksEnabled) {
      console.log('CF Bypass: Hooks disabled, skipping initialization');
      return;
    }
    
    hooksInitialized = true;
    
    // 立即尝试hook已存在的对象
    hookTurnstile();
    hookHCaptcha();
    hookRecaptcha();
    
    // 新增：监听控制台和手动输入
    hookConsoleForWebsiteKey();
    setupManualWebsiteKeyInput();
    
    // 新增：监听用户点击行为
    monitorUserClicks();
    
    // 监听Cloudflare beacon和网络请求
    monitorCloudflareBeacon();
    hookNetworkRequests();
    
    // 监听新加载的脚本
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
            // 检查是否是验证码相关脚本
            const src = node.src || '';
            if (src.includes('turnstile') || src.includes('captcha') || src.includes('recaptcha')) {
              console.log('CF Bypass: Captcha script loaded:', src);
            }
            
            // 延迟检查，等待脚本加载完成
            setTimeout(() => {
              hookTurnstile();
              hookHCaptcha();
              hookRecaptcha();
            }, 100);
            
            // 额外延迟检查
            setTimeout(() => {
              hookTurnstile();
              hookHCaptcha();
              hookRecaptcha();
            }, 1000);
          }
        });
      });
    });

    observer.observe(document.head || document.documentElement, {
      childList: true,
      subtree: true
    });
    
    // 定期检查（针对动态加载的脚本）
    let checkCount = 0;
    const periodicCheck = setInterval(() => {
      checkCount++;
      hookTurnstile();
      hookHCaptcha();
      hookRecaptcha();
      
      // 检查10次后停止
      if (checkCount >= 10) {
        clearInterval(periodicCheck);
      }
    }, 2000);
  }

  // 立即初始化hooks（在脚本加载时）
  initHooks();

  // 当DOM准备就绪时再次初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHooks);
  } else {
    // DOM已经准备就绪，延迟再次初始化
    setTimeout(initHooks, 100);
  }

  // 也在window加载完成后再次尝试
  window.addEventListener('load', function() {
    setTimeout(initHooks, 1000);
  });

})();