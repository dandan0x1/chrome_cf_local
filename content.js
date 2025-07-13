// Content script for captcha detection and bypass
// 用于学术研究目的的Cloudflare验证码绕过工具

class CaptchaDetector {
  constructor() {
    this.detectionInterval = null;
    this.bypassInProgress = false;
    this.detectedCaptchas = new Map();
    this.jsHooksEnabled = true; // 默认启用JS hooks
    
    this.init();
  }

  init() {
    console.log('CF Bypass Research Tool: Content script loaded');
    
    // 先检查JS拦截设置
    this.loadJSInterceptionSettings();
    
    // 注入inject script
    this.injectScript();
    
    // 监听来自background script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // 监听来自inject script的消息
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      this.handlePageMessage(event.data);
    });

    // 开始检测验证码
    this.startDetection();
    
    // 监听DOM变化
    this.observePageChanges();
    
    // 通知background script页面已加载
    chrome.runtime.sendMessage({
      action: 'pageLoaded',
      url: window.location.href
    });
  }

  // 加载JS拦截设置
  loadJSInterceptionSettings() {
    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(['enableJSInterception'], (result) => {
        this.jsHooksEnabled = result.enableJSInterception !== false;
        console.log('CF Bypass: JS Hooks enabled:', this.jsHooksEnabled);
        
        // 如果JS拦截被禁用，通知inject script禁用hooks
        if (!this.jsHooksEnabled) {
          setTimeout(() => {
            this.disableJSHooks();
          }, 1000);
        }
      });
    }
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'detectCaptcha':
        this.detectAllCaptchas();
        sendResponse({success: true});
        break;
        
      case 'cloudflareDetected':
        this.handleCloudflareDetection(request.url);
        sendResponse({success: true});
        break;
        
      case 'bypassSuccess':
        this.handleBypassSuccess(request);
        sendResponse({success: true});
        break;
        
      case 'bypassFailed':
        this.handleBypassFailed(request.error);
        sendResponse({success: true});
        break;

      // 来自popup的新消息
      case 'useWebsiteKey':
        this.handlePopupWebsiteKey(request.websiteKey);
        sendResponse({success: true});
        break;

      case 'forceDetect':
        this.detectAllCaptchas();
        sendResponse({success: true});
        break;

      case 'debugPage':
        this.runPageDebug();
        sendResponse({success: true});
        break;

      case 'disableHooks':
        this.disableJSHooks();
        sendResponse({success: true});
        break;

      case 'enableHooks':
        this.enableJSHooks();
        sendResponse({success: true});
        break;
        
      case 'updateSafeMode':
        this.updateSafeMode(request.safeMode);
        sendResponse({success: true});
        break;
        
      case 'manualSubmit':
        this.manualSubmit();
        sendResponse({success: true});
        break;
        
      default:
        sendResponse({error: 'Unknown action'});
    }
  }

  startDetection() {
    console.log('CF Bypass: Starting captcha detection...');
    
    // 立即检测一次
    this.detectAllCaptchas();
    
    // 等待框架加载后再次检测
    setTimeout(() => {
      console.log('CF Bypass: Framework load delay detection...');
      this.detectAllCaptchas();
    }, 2000);
    
    // 再次等待更长时间检测（针对慢加载的框架）
    setTimeout(() => {
      console.log('CF Bypass: Extended delay detection...');
      this.detectAllCaptchas();
    }, 5000);
    
    // 定期检测（降低频率以提高性能）
    this.detectionInterval = setInterval(() => {
      this.detectAllCaptchas();
    }, 5000);
    
    // 监听常见框架加载事件
    this.listenForFrameworkEvents();
  }

  stopDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }

  listenForFrameworkEvents() {
    // 监听React/Vue等框架的路由变化
    window.addEventListener('popstate', () => {
      console.log('CF Bypass: Route change detected');
      setTimeout(() => this.detectAllCaptchas(), 1000);
    });
    
    // 监听pushState和replaceState（SPA路由）
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      console.log('CF Bypass: PushState detected');
      setTimeout(() => window.captchaDetector && window.captchaDetector.detectAllCaptchas(), 1000);
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      console.log('CF Bypass: ReplaceState detected');
      setTimeout(() => window.captchaDetector && window.captchaDetector.detectAllCaptchas(), 1000);
    };
    
    // 监听Ajax请求完成
    const originalFetch = window.fetch;
    window.fetch = function() {
      return originalFetch.apply(this, arguments).then(response => {
        if (response.url.includes('challenge') || response.url.includes('captcha')) {
          console.log('CF Bypass: Challenge/captcha request detected');
          setTimeout(() => window.captchaDetector && window.captchaDetector.detectAllCaptchas(), 2000);
        }
        return response;
      });
    };
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      let shouldDetect = false;
      let hasSignificantChange = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 检查是否是验证码相关的节点
              if (this.containsCaptcha(node)) {
                console.log('CF Bypass: Captcha element added to DOM');
                shouldDetect = true;
              }
              
              // 检查是否是大的DOM变化（可能是框架重新渲染）
              if (node.children && node.children.length > 10) {
                hasSignificantChange = true;
              }
              
              // 检查常见的框架容器
              const classNameStr = (node.className && typeof node.className === 'string') ? node.className : 
                                 (node.className && node.className.toString) ? node.className.toString() : '';
              if (node.id === 'app' || node.id === 'root' || 
                  classNameStr.includes('app') || 
                  classNameStr.includes('container')) {
                console.log('CF Bypass: Framework container detected');
                hasSignificantChange = true;
              }
            }
          });
        }
        
        // 检查属性变化（可能是验证码状态改变）
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target && target.className) {
            const classNameStr = (typeof target.className === 'string') ? target.className : 
                               (target.className.toString) ? target.className.toString() : '';
            if (classNameStr.includes('captcha') || 
                classNameStr.includes('turnstile') ||
                classNameStr.includes('challenge')) {
              console.log('CF Bypass: Captcha element attributes changed');
              shouldDetect = true;
            }
          }
        }
      });
      
      if (shouldDetect) {
        // 立即检测
        setTimeout(() => this.detectAllCaptchas(), 500);
      } else if (hasSignificantChange) {
        // 延迟检测（等待框架渲染完成）
        setTimeout(() => this.detectAllCaptchas(), 2000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'data-sitekey', 'data-site-key']
    });
    
    console.log('CF Bypass: DOM observer initialized');
  }

  containsCaptcha(element) {
    const captchaSelectors = [
      '.cf-turnstile',
      '[data-sitekey]',
      '[data-site-key]',
      '.h-captcha',
      '.g-recaptcha',
      '#cf-challenge-stage',
      '.cf-browser-verification',
      '.cf-checking-browser',
      '.cf-under-attack',
      '[id*="captcha"]',
      '[class*="captcha"]',
      '[id*="turnstile"]',
      '[class*="turnstile"]',
      '[id*="challenge"]',
      '[class*="challenge"]',
      // 常见的验证码容器ID和类名
      '#captcha-container',
      '#turnstile-container',
      '#challenge-container',
      '.captcha-wrapper',
      '.turnstile-wrapper',
      '.challenge-wrapper'
    ];
    
    return captchaSelectors.some(selector => {
      try {
        return (element.matches && element.matches(selector)) ||
               (element.querySelector && element.querySelector(selector));
      } catch (e) {
        return false;
      }
    });
  }

  detectAllCaptchas() {
    if (this.bypassInProgress) {
      console.log('CF Bypass: Bypass in progress, skipping detection');
      return;
    }
    
    console.log('CF Bypass: Detecting captchas on:', window.location.href);
    
    // 特殊网站处理
    if (window.location.hostname.includes('nodepay.ai')) {
      console.log('CF Bypass: NodePay.ai specific detection');
      this.detectNodePayCaptcha();
    }
    
    // 等待DOM稳定后再检测
    if (document.readyState !== 'complete') {
      console.log('CF Bypass: Document not ready, scheduling detection...');
      setTimeout(() => this.detectAllCaptchas(), 1000);
      return;
    }
    
    try {
      // 检测Cloudflare Turnstile
      this.detectTurnstile();
      
      // 检测hCaptcha
      this.detectHCaptcha();
      
      // 检测reCAPTCHA v2
      this.detectRecaptchaV2();
      
      // 检测reCAPTCHA v3
      this.detectRecaptchaV3();
      
      // 检测Cloudflare Challenge页面
      this.detectCloudflareChallenge();
      
      // 检测通用验证码容器
      this.detectGenericCaptcha();
      
    } catch (error) {
      console.error('CF Bypass: Error during captcha detection:', error);
    }
  }

  detectNodePayCaptcha() {
    console.log('CF Bypass: Running NodePay-specific captcha detection...');
    
    // 防止无限递归 - 添加检测计数器
    if (!this.nodepayDetectionCount) {
      this.nodepayDetectionCount = 0;
    }
    this.nodepayDetectionCount++;
    
    if (this.nodepayDetectionCount > 5) {
      console.log('CF Bypass: NodePay - Maximum detection attempts reached');
      return;
    }
    
    // 等待页面稳定
    if (document.readyState !== 'complete') {
      console.log('CF Bypass: NodePay - Document not complete, waiting...');
      setTimeout(() => this.detectNodePayCaptcha(), 2000);
      return;
    }
    
    // NodePay可能使用的验证码选择器
    const nodepaySelectors = [
      // 通用验证码选择器
      '[data-sitekey]',
      '[data-site-key]',
      '.cf-turnstile',
      '.h-captcha',
      '.g-recaptcha',
      
      // 可能的自定义容器
      '.captcha',
      '.verification',
      '.challenge',
      '#captcha',
      '#verification',
      '#challenge',
      
      // React/Vue组件可能的类名
      '[class*="Captcha"]',
      '[class*="Verification"]',
      '[class*="Challenge"]',
      '[id*="captcha"]',
      '[id*="verification"]',
      '[id*="challenge"]',
      
      // 表单相关
      'form [data-sitekey]',
      'form .captcha',
      '.login-form [data-sitekey]',
      '.auth-form [data-sitekey]',
      
      // 更具体的NodePay选择器
      '.nodepay-captcha',
      '.verify-container',
      '.security-check',
      '[class*="verify"]',
      '[class*="security"]',
      
      // iframe检测
      'iframe[src*="turnstile"]',
      'iframe[src*="captcha"]',
      'iframe[title*="captcha"]',
      'iframe[title*="verification"]',
      
      // 脚本加载的元素
      'div[id^="cf-"]',
      'div[class*="cf-"]',
      'div[data-callback]',
      'div[data-theme]'
    ];
    
    let foundCaptcha = false;
    
    console.log(`CF Bypass: NodePay - Checking ${nodepaySelectors.length} selectors...`);
    
    nodepaySelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`CF Bypass: NodePay - Found ${elements.length} elements with selector "${selector}"`);
          
          elements.forEach((element, index) => {
            const sitekey = this.findSitekey(element);
            const elementInfo = {
              selector: selector,
              index: index,
              tagName: element.tagName,
              id: element.id,
              className: this.safeGetClassName(element),
              sitekey: sitekey,
              visible: this.isElementVisible(element),
              rect: element.getBoundingClientRect(),
              innerHTML: element.innerHTML.substring(0, 200)
            };
            
            console.log('CF Bypass: NodePay - Element details:', elementInfo);
            
            if (sitekey && this.isElementVisible(element)) {
              // 根据sitekey推断验证码类型
              let captchaType = 'cftoken';
              if (sitekey.startsWith('0x')) {
                captchaType = 'cftoken';
              } else if (sitekey.length === 40) {
                captchaType = 'hcaptcha';
              } else if (sitekey.length >= 30) {
                captchaType = 'recaptchav2';
              }
              
              const captchaId = `nodepay-${captchaType}-${sitekey}`;
              
              if (!this.detectedCaptchas.has(captchaId)) {
                console.log(`CF Bypass: NodePay - Detected ${captchaType} with sitekey:`, sitekey);
                
                this.detectedCaptchas.set(captchaId, {
                  type: captchaType,
                  element: element,
                  sitekey: sitekey,
                  url: window.location.href,
                  site: 'nodepay'
                });
                
                foundCaptcha = true;
                this.triggerBypass(captchaType, sitekey, element);
              }
            }
          });
        }
      } catch (e) {
        console.error(`CF Bypass: NodePay - Error with selector "${selector}":`, e);
      }
    });
    
    // 如果没有找到，尝试深度搜索
    if (!foundCaptcha) {
      console.log('CF Bypass: NodePay - No captcha found with standard selectors, trying deep search...');
      this.deepSearchNodePay();
    }
    
    // 检查是否有延迟加载的内容（减少递归调用）
    if (!foundCaptcha && this.nodepayDetectionCount <= 3) {
      setTimeout(() => {
        console.log('CF Bypass: NodePay - Retrying detection after 3s delay...');
        this.detectNodePayCaptcha();
      }, 3000);
    } else if (!foundCaptcha && this.nodepayDetectionCount === 4) {
      setTimeout(() => {
        console.log('CF Bypass: NodePay - Final retry after 8s delay...');
        this.detectNodePayCaptcha();
      }, 8000);
    }
  }
  
  // 添加安全的className获取方法
  safeGetClassName(element) {
    const className = element.className;
    return (className && typeof className === 'string') ? className : 
           (className && className.toString) ? className.toString() : '';
  }
  
  deepSearchNodePay() {
    console.log('CF Bypass: NodePay - Running deep search...');
    
    // 搜索所有元素寻找可能的验证码迹象
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(element => {
      // 检查属性中是否有sitekey
      if (element.hasAttribute('data-sitekey') || element.hasAttribute('data-site-key')) {
        const sitekey = element.getAttribute('data-sitekey') || element.getAttribute('data-site-key');
        console.log('CF Bypass: NodePay - Deep search found element with sitekey:', {
          element: element,
          sitekey: sitekey,
          visible: this.isElementVisible(element)
        });
      }
      
      // 检查文本内容
      const text = element.textContent || '';
      if (text.toLowerCase().includes('verify') || 
          text.toLowerCase().includes('captcha') || 
          text.toLowerCase().includes('robot')) {
        console.log('CF Bypass: NodePay - Found element with verification text:', {
          element: element,
          text: text.substring(0, 100),
          visible: this.isElementVisible(element)
        });
      }
      
      // 检查类名和ID
      const className = element.className;
      const id = element.id;
      
      // 安全检查类名和ID类型
      const classNameStr = (className && typeof className === 'string') ? className : 
                          (className && className.toString) ? className.toString() : '';
      const idStr = (id && typeof id === 'string') ? id : '';
      
      if (classNameStr.toLowerCase().includes('captcha') || 
          classNameStr.toLowerCase().includes('turnstile') ||
          idStr.toLowerCase().includes('captcha') || 
          idStr.toLowerCase().includes('turnstile')) {
        console.log('CF Bypass: NodePay - Found element with captcha-related class/id:', {
          element: element,
          className: classNameStr,
          id: idStr,
          visible: this.isElementVisible(element)
        });
      }
    });
    
    // 检查所有脚本标签
    const scripts = document.querySelectorAll('script');
    scripts.forEach((script, index) => {
      const content = script.textContent || script.innerHTML;
      if (content && content.includes('sitekey')) {
        console.log(`CF Bypass: NodePay - Script ${index} contains sitekey:`, {
          src: script.src,
          content: content.substring(0, 300)
        });
        
        // 尝试提取sitekey
        const sitekeyMatch = content.match(/sitekey['"\\s]*[:=]['"\\s]*([a-zA-Z0-9_-]+)/);
        if (sitekeyMatch) {
          console.log('CF Bypass: NodePay - Extracted sitekey from script:', sitekeyMatch[1]);
        }
      }
    });
  }
  
  detectTurnstile() {
    const turnstileElements = document.querySelectorAll('.cf-turnstile, [data-sitekey*="0x"], [data-site-key*="0x"]');
    
    turnstileElements.forEach((element) => {
      const sitekey = element.getAttribute('data-sitekey') || 
                     element.getAttribute('data-site-key');
      
      if (sitekey && !this.detectedCaptchas.has(`turnstile-${sitekey}`)) {
        console.log('CF Bypass: Detected Cloudflare Turnstile:', sitekey);
        
        this.detectedCaptchas.set(`turnstile-${sitekey}`, {
          type: 'cftoken',
          element: element,
          sitekey: sitekey,
          url: window.location.href
        });
        
        this.triggerBypass('cftoken', sitekey, element);
      }
    });
    
    // 检查iframe中的turnstile（某些框架会将验证码放在iframe中）
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        if (iframe.src && iframe.src.includes('turnstile')) {
          console.log('CF Bypass: Detected Turnstile iframe');
          // 尝试从父元素获取sitekey
          const parent = iframe.closest('[data-sitekey], [data-site-key]');
          if (parent) {
            const sitekey = parent.getAttribute('data-sitekey') || parent.getAttribute('data-site-key');
            if (sitekey && !this.detectedCaptchas.has(`turnstile-iframe-${sitekey}`)) {
              console.log('CF Bypass: Detected Turnstile in iframe with sitekey:', sitekey);
              this.detectedCaptchas.set(`turnstile-iframe-${sitekey}`, {
                type: 'cftoken',
                element: iframe,
                sitekey: sitekey,
                url: window.location.href
              });
              this.triggerBypass('cftoken', sitekey, iframe);
            }
          }
        }
      } catch (e) {
        // Cross-origin iframe access error, ignore
      }
    });
  }

  detectHCaptcha() {
    const hcaptchaElements = document.querySelectorAll('.h-captcha, [data-sitekey]:not([data-sitekey*="0x"])');
    
    hcaptchaElements.forEach((element) => {
      const sitekey = element.getAttribute('data-sitekey');
      
      if (sitekey && !this.detectedCaptchas.has(`hcaptcha-${sitekey}`)) {
        console.log('Detected hCaptcha:', sitekey);
        
        this.detectedCaptchas.set(`hcaptcha-${sitekey}`, {
          type: 'hcaptcha',
          element: element,
          sitekey: sitekey,
          url: window.location.href
        });
        
        this.triggerBypass('hcaptcha', sitekey, element);
      }
    });
  }

  detectRecaptchaV2() {
    const recaptchaElements = document.querySelectorAll('.g-recaptcha, [data-sitekey]');
    
    recaptchaElements.forEach((element) => {
      const sitekey = element.getAttribute('data-sitekey');
      
      // 排除已检测的其他类型
      if (sitekey && 
          !sitekey.startsWith('0x') && 
          !element.classList.contains('h-captcha') &&
          !this.detectedCaptchas.has(`recaptchav2-${sitekey}`)) {
        
        console.log('Detected reCAPTCHA v2:', sitekey);
        
        this.detectedCaptchas.set(`recaptchav2-${sitekey}`, {
          type: 'recaptchav2',
          element: element,
          sitekey: sitekey,
          url: window.location.href
        });
        
        this.triggerBypass('recaptchav2', sitekey, element);
      }
    });
  }

  detectRecaptchaV3() {
    // 检测reCAPTCHA v3 (通常在页面源码中)
    const scripts = document.querySelectorAll('script');
    
    scripts.forEach((script) => {
      const content = script.textContent || script.innerHTML;
      
      if (content && content.includes('grecaptcha.execute')) {
        const sitekeyMatch = content.match(/['""]([0-9A-Za-z_-]{40})['"]/);
        
        if (sitekeyMatch && !this.detectedCaptchas.has(`recaptchav3-${sitekeyMatch[1]}`)) {
          console.log('Detected reCAPTCHA v3:', sitekeyMatch[1]);
          
          this.detectedCaptchas.set(`recaptchav3-${sitekeyMatch[1]}`, {
            type: 'recaptchav3',
            element: script,
            sitekey: sitekeyMatch[1],
            url: window.location.href
          });
          
          this.triggerBypass('recaptchav3', sitekeyMatch[1], script);
        }
      }
    });
  }

  detectGenericCaptcha() {
    // 检测通过类名或ID可能包含验证码的元素
    const genericSelectors = [
      '[id*="captcha"]',
      '[class*="captcha"]', 
      '[id*="challenge"]',
      '[class*="challenge"]',
      '[id*="verification"]',
      '[class*="verification"]',
      '.captcha-container',
      '.challenge-container',
      '.verification-container'
    ];
    
    genericSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          // 检查元素是否可见且不是已知类型
          if (this.isElementVisible(element) && !this.isKnownCaptchaType(element)) {
            // 尝试找到data-sitekey属性
            const sitekey = this.findSitekey(element);
            if (sitekey && !this.detectedCaptchas.has(`generic-${sitekey}`)) {
              console.log('CF Bypass: Detected generic captcha element:', selector, sitekey);
              
              // 根据sitekey格式推断类型
              let captchaType = 'cftoken'; // 默认
              if (sitekey.startsWith('0x')) {
                captchaType = 'cftoken';
              } else if (sitekey.length === 40) {
                captchaType = 'hcaptcha';
              } else {
                captchaType = 'recaptchav2';
              }
              
              this.detectedCaptchas.set(`generic-${sitekey}`, {
                type: captchaType,
                element: element,
                sitekey: sitekey,
                url: window.location.href
              });
              
              this.triggerBypass(captchaType, sitekey, element);
            }
          }
        });
      } catch (e) {
        console.error('CF Bypass: Error in generic captcha detection:', e);
      }
    });
  }
  
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }
  
  isKnownCaptchaType(element) {
    return element.classList.contains('cf-turnstile') ||
           element.classList.contains('h-captcha') ||
           element.classList.contains('g-recaptcha') ||
           element.id === 'cf-challenge-stage';
  }
  
  findSitekey(element) {
    // 直接在元素上查找
    let sitekey = element.getAttribute('data-sitekey') || element.getAttribute('data-site-key');
    
    // 在子元素中查找
    if (!sitekey) {
      const childWithSitekey = element.querySelector('[data-sitekey], [data-site-key]');
      if (childWithSitekey) {
        sitekey = childWithSitekey.getAttribute('data-sitekey') || childWithSitekey.getAttribute('data-site-key');
      }
    }
    
    // 在父元素中查找
    if (!sitekey) {
      const parentWithSitekey = element.closest('[data-sitekey], [data-site-key]');
      if (parentWithSitekey) {
        sitekey = parentWithSitekey.getAttribute('data-sitekey') || parentWithSitekey.getAttribute('data-site-key');
      }
    }
    
    // 从脚本标签中查找（针对动态加载的验证码）
    if (!sitekey) {
      const scripts = document.querySelectorAll('script');
      for (let script of scripts) {
        const content = script.textContent || script.innerHTML;
        if (content.includes('sitekey') || content.includes('site_key') || 
            content.includes('turnstile') || content.includes('captcha')) {
          
          // 匹配多种sitekey格式
          const patterns = [
            /['""]([0-9A-Za-z_-]{20,})['""]/g,
            /sitekey['"\s]*[:=]['"\s]*([a-zA-Z0-9_-]+)/g,
            /site_key['"\s]*[:=]['"\s]*([a-zA-Z0-9_-]+)/g,
            /data-sitekey=['"]([^'"]+)['"]/g,
            /turnstile.*?['"]([0-9A-Fa-f]{40,})['"]|turnstile.*?['"]([0-9A-Za-z_-]{20,})['"]]/g
          ];
          
          for (let pattern of patterns) {
            const matches = [...content.matchAll(pattern)];
            for (let match of matches) {
              const key = match[1] || match[2];
              if (key && key.length >= 20 && !key.includes(' ')) {
                console.log(`CF Bypass: Found potential sitekey in script: ${key}`);
                sitekey = key;
                break;
              }
            }
            if (sitekey) break;
          }
        }
        if (sitekey) break;
      }
    }
    
    return sitekey;
  }
  
  detectCloudflareChallenge() {
    // 检测Cloudflare挑战页面
    const challengeElements = document.querySelectorAll(
      '#cf-challenge-stage, .cf-browser-verification, .cf-im-under-attack'
    );
    
    if (challengeElements.length > 0 && !this.detectedCaptchas.has('cf-challenge')) {
      console.log('CF Bypass: Detected Cloudflare Challenge page');
      
      this.detectedCaptchas.set('cf-challenge', {
        type: 'cfcookie',
        element: challengeElements[0],
        sitekey: null,
        url: window.location.href
      });
      
      this.triggerBypass('cfcookie', null, challengeElements[0]);
    }
  }

  handleCloudflareDetection(url) {
    console.log('Cloudflare protection detected on:', url);
    
    // 延迟检测，等待页面完全加载
    setTimeout(() => {
      this.detectCloudflareChallenge();
    }, 2000);
  }

  async triggerBypass(captchaType, sitekey, element) {
    if (this.bypassInProgress) return;
    
    this.bypassInProgress = true;
    console.log(`CF Bypass: Triggering bypass for ${captchaType}:`, sitekey);
    
    // 在元素上显示处理状态
    this.showProcessingStatus(element);
    
    try {
      console.log('CF Bypass: Sending bypass request to background...');
      const response = await chrome.runtime.sendMessage({
        action: 'bypassCaptcha',
        captchaType: captchaType,
        websiteUrl: window.location.href,
        websiteKey: sitekey
      });
      
      console.log('CF Bypass: Background response:', response);
      
      if (!response) {
        throw new Error('No response from background script');
      }
      
      if (!response.success) {
        throw new Error(response.error || 'Bypass request failed');
      }
      
    } catch (error) {
      console.error('CF Bypass: Bypass trigger failed:', error);
      
      // 检查是否是runtime错误
      if (chrome.runtime.lastError) {
        console.error('CF Bypass: Chrome runtime error:', chrome.runtime.lastError);
      }
      
      this.hideProcessingStatus(element);
      this.bypassInProgress = false;
    }
  }

  handleBypassSuccess(request) {
    console.log('Bypass successful:', request);
    
    const {token, cf_clearance, captchaType} = request;
    
    if (captchaType === 'cfcookie' && cf_clearance) {
      // 处理cf_clearance cookie
      this.applyCfClearance(cf_clearance);
    } else if (token) {
      // 处理token
      this.applyToken(token, captchaType);
    }
    
    this.bypassInProgress = false;
    
    // 通知background script完成
    chrome.runtime.sendMessage({
      action: 'bypassComplete',
      success: true
    });
  }

  handleBypassFailed(error) {
    console.error('Bypass failed:', error);
    this.bypassInProgress = false;
    
    // 移除处理状态
    document.querySelectorAll('.cf-bypass-processing').forEach(el => {
      this.hideProcessingStatus(el);
    });
  }

  applyCfClearance(cfClearance) {
    console.log('Applying cf_clearance cookie');
    
    // 设置cookie
    document.cookie = `cf_clearance=${cfClearance}; path=/; domain=${window.location.hostname}`;
    
    // 刷新页面
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  applyToken(token, captchaType) {
    console.log(`Applying ${captchaType} token:`, token.substring(0, 20) + '...');
    
    switch (captchaType) {
      case 'cftoken':
        this.applyTurnstileToken(token);
        break;
      case 'hcaptcha':
        this.applyHCaptchaToken(token);
        break;
      case 'recaptchav2':
        this.applyRecaptchaV2Token(token);
        break;
      case 'recaptchav3':
        this.applyRecaptchaV3Token(token);
        break;
    }
  }

  applyTurnstileToken(token) {
    console.log('CF Bypass: Applying Turnstile token:', token.substring(0, 20) + '...');
    
    // 方法1: 查找并设置响应字段
    const responseFields = document.querySelectorAll('input[name="cf-turnstile-response"]');
    let fieldsFound = responseFields.length;
    
    responseFields.forEach((field, index) => {
      console.log(`CF Bypass: Setting response field ${index}:`, field);
      field.value = token;
      field.dispatchEvent(new Event('change', {bubbles: true}));
      field.dispatchEvent(new Event('input', {bubbles: true}));
    });
    
    // 方法2: 查找隐藏的textarea（有些实现使用textarea）
    const textareaFields = document.querySelectorAll('textarea[name="cf-turnstile-response"]');
    textareaFields.forEach((field, index) => {
      console.log(`CF Bypass: Setting textarea field ${index}:`, field);
      field.value = token;
      field.dispatchEvent(new Event('change', {bubbles: true}));
      field.dispatchEvent(new Event('input', {bubbles: true}));
      fieldsFound++;
    });
    
    // 方法3: 通过Turnstile API注入（如果可用）
    if (window.turnstile && window.turnstile.render) {
      console.log('CF Bypass: Attempting Turnstile API injection');
      // 发送token到inject script进行API级别的注入
      window.postMessage({
        type: 'CF_BYPASS_INJECT_TOKEN',
        data: {
          token: token,
          captchaType: 'cftoken'
        }
      }, '*');
    }
    
    // 方法4: 查找data-callback并触发
    const turnstileContainers = document.querySelectorAll('.cf-turnstile, [data-sitekey]');
    turnstileContainers.forEach((container, index) => {
      const callback = container.getAttribute('data-callback');
      if (callback && window[callback]) {
        console.log(`CF Bypass: Triggering callback ${callback} for container ${index}`);
        try {
          window[callback](token);
        } catch (e) {
          console.warn('CF Bypass: Error calling callback:', e);
        }
      }
    });
    
    console.log(`CF Bypass: Found ${fieldsFound} response fields`);
    
    // 给网站一些时间处理token，然后尝试提交
    setTimeout(() => {
      this.triggerFormSubmission();
    }, 500);
    
    // 也立即尝试一次（有些网站需要立即响应）
    this.triggerFormSubmission();
  }

  applyHCaptchaToken(token) {
    // 查找hCaptcha响应字段
    const responseFields = document.querySelectorAll('textarea[name="h-captcha-response"]');
    
    responseFields.forEach(field => {
      field.value = token;
      field.dispatchEvent(new Event('change', {bubbles: true}));
    });
    
    this.triggerFormSubmission();
  }

  applyRecaptchaV2Token(token) {
    // 查找reCAPTCHA响应字段
    const responseFields = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
    
    responseFields.forEach(field => {
      field.value = token;
      field.dispatchEvent(new Event('change', {bubbles: true}));
    });
    
    this.triggerFormSubmission();
  }

  applyRecaptchaV3Token(token) {
    // reCAPTCHA v3通常需要在JavaScript中处理
    window.cfBypassToken = token;
    
    // 尝试调用可能的回调函数
    if (window.recaptchaCallback) {
      window.recaptchaCallback(token);
    }
  }

  triggerFormSubmission() {
    console.log('CF Bypass: Attempting to trigger form submission...');
    
    // 查找并提交相关表单
    const forms = document.querySelectorAll('form');
    let formsFound = 0;
    
    forms.forEach((form, index) => {
      const hasResponseField = form.querySelector(
        'input[name="cf-turnstile-response"], textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"], textarea[name="cf-turnstile-response"]'
      );
      const hasTurnstile = form.querySelector('.cf-turnstile, .h-captcha, .g-recaptcha, [data-sitekey]');
      
      if (hasResponseField || hasTurnstile) {
        console.log(`CF Bypass: Found relevant form ${index}:`, form);
        formsFound++;
        
        // 触发表单事件
        form.dispatchEvent(new Event('change', {bubbles: true}));
        form.dispatchEvent(new Event('input', {bubbles: true}));
        
        // 查找提交按钮 - 扩展搜索范围
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]', 
          'button:not([type])',
          'button[class*="submit"]',
          'button[id*="submit"]',
          '[role="button"][class*="submit"]',
          '.submit-btn',
          '.login-btn',
          '.signin-btn',
          'button[class*="login"]',
          'button[class*="signin"]',
          'button[class*="continue"]',
          'button[class*="next"]'
        ];
        
        let submitBtn = null;
        for (const selector of submitSelectors) {
          submitBtn = form.querySelector(selector);
          if (submitBtn && !submitBtn.disabled) {
            break;
          }
        }
        
        if (submitBtn && !submitBtn.disabled) {
          console.log(`CF Bypass: Found submit button for form ${index}:`, submitBtn);
          
          // 延迟点击，给验证码处理时间
          setTimeout(() => {
            console.log('CF Bypass: Clicking submit button...');
            submitBtn.click();
          }, 300);
          
          // 也立即尝试一次
          setTimeout(() => {
            if (!submitBtn.disabled) {
              submitBtn.click();
            }
          }, 50);
        } else {
          console.log(`CF Bypass: No submit button found for form ${index}, attempting direct submit`);
          
          // 直接提交表单
          setTimeout(() => {
            try {
              form.submit();
            } catch (e) {
              console.warn('CF Bypass: Error submitting form:', e);
            }
          }, 500);
        }
      }
    });
    
    console.log(`CF Bypass: Found ${formsFound} relevant forms`);
    
    // 如果没有找到表单，尝试查找页面上的提交按钮
    if (formsFound === 0) {
      console.log('CF Bypass: No forms found, looking for standalone submit buttons...');
      this.findAndClickSubmitButtons();
    }
  }

  // 查找并点击独立的提交按钮（不在form中的）
  findAndClickSubmitButtons() {
    const buttonSelectors = [
      'button[class*="submit"]',
      'button[id*="submit"]',
      'button[class*="login"]',
      'button[class*="signin"]',
      'button[class*="continue"]',
      'button[class*="next"]',
      '[role="button"][class*="submit"]',
      '.submit-btn',
      '.login-btn',
      '.signin-btn'
    ];
    
    buttonSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach((button, index) => {
        // 检查按钮是否在验证码附近
        const nearCaptcha = button.closest('form') || 
                           button.parentElement.querySelector('.cf-turnstile, .h-captcha, .g-recaptcha, [data-sitekey]') ||
                           document.querySelector('.cf-turnstile, .h-captcha, .g-recaptcha, [data-sitekey]');
        
        if (nearCaptcha && !button.disabled) {
          console.log(`CF Bypass: Found standalone submit button:`, button);
          setTimeout(() => {
            button.click();
          }, 600);
        }
      });
    });
  }

  showProcessingStatus(element) {
    if (!element) return;
    
    element.classList.add('cf-bypass-processing');
    
    // 创建状态overlay
    const overlay = document.createElement('div');
    overlay.className = 'cf-bypass-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 123, 255, 0.8);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      border-radius: 4px;
    `;
    overlay.textContent = 'Processing bypass...';
    
    if (element.style.position !== 'absolute' && element.style.position !== 'relative') {
      element.style.position = 'relative';
    }
    
    element.appendChild(overlay);
  }

  hideProcessingStatus(element) {
    if (!element) return;
    
    element.classList.remove('cf-bypass-processing');
    
    const overlay = element.querySelector('.cf-bypass-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  injectScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject.js');
      script.onload = function() {
        console.log('CF Bypass: Inject script loaded successfully');
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      console.error('Failed to inject script:', error);
    }
  }

  handlePageMessage(data) {
    if (!data || !data.type) return;
    
    console.log('CF Bypass: Received page message:', data.type, data);
    
    switch (data.type) {
      case 'CF_BYPASS_TURNSTILE_RENDER':
        console.log('CF Bypass: Turnstile render detected via hook:', data);
        this.handleTurnstileRender(data);
        break;
        
      case 'CF_BYPASS_TURNSTILE_RENDERED':
        console.log('CF Bypass: Turnstile rendering completed:', data);
        this.handleTurnstileRendered(data);
        break;
        
      case 'CF_BYPASS_BEACON_DETECTED':
        console.log('CF Bypass: Cloudflare beacon detected:', data);
        this.handleBeaconDetected(data);
        break;
        
      case 'CF_BYPASS_CHALLENGE_REDIRECT':
        console.log('CF Bypass: Challenge redirect detected:', data);
        this.handleChallengeRedirect(data);
        break;
        
      case 'CF_BYPASS_NETWORK_SITEKEY':
        console.log('CF Bypass: Network sitekey detected:', data);
        this.handleNetworkSitekey(data);
        break;
        
      case 'CF_BYPASS_CONSOLE_WEBSITEKEY':
        console.log('CF Bypass: Console websiteKey detected:', data);
        this.handleConsoleWebsiteKey(data);
        break;
        
      case 'CF_BYPASS_MANUAL_WEBSITEKEY':
        console.log('CF Bypass: Manual websiteKey set:', data);
        this.handleManualWebsiteKey(data);
        break;
        
      case 'CF_BYPASS_CLICK_DETECTED':
        console.log('CF Bypass: User click on captcha detected:', data);
        this.handleClickDetected(data);
        break;
        
      case 'CF_BYPASS_FORCE_DETECTED':
        console.log('CF Bypass: Force search detected captcha:', data);
        this.handleForceDetected(data);
        break;
        
      case 'CF_BYPASS_HCAPTCHA_RENDER':
      case 'CF_BYPASS_RECAPTCHA_RENDER':
      case 'CF_BYPASS_RECAPTCHA_EXECUTE':
        console.log('CF Bypass: Captcha detected via page hook:', data);
        // 延迟检测以确保元素已渲染
        setTimeout(() => this.detectAllCaptchas(), 1000);
        break;
    }
  }

  // Handler for popup websiteKey input
  handlePopupWebsiteKey(websiteKey) {
    console.log('CF Bypass: Received websiteKey from popup:', websiteKey);
    
    if (websiteKey && websiteKey.trim()) {
      const captchaId = `popup-turnstile-${websiteKey}`;
      
      if (!this.detectedCaptchas.has(captchaId)) {
        // Create virtual element to represent this captcha
        const virtualElement = document.createElement('div');
        virtualElement.setAttribute('data-sitekey', websiteKey);
        virtualElement.setAttribute('data-source', 'popup-input');
        
        this.detectedCaptchas.set(captchaId, {
          type: 'cftoken',
          element: virtualElement,
          sitekey: websiteKey,
          url: window.location.href,
          source: 'popup-input'
        });
        
        console.log('CF Bypass: Triggering bypass for popup-provided websiteKey');
        this.triggerBypass('cftoken', websiteKey, virtualElement);
      }
    } else {
      console.error('CF Bypass: Invalid websiteKey received from popup');
    }
  }

  // Handler for page debugging from popup
  runPageDebug() {
    console.log('CF Bypass: Running page debug from popup...');
    
    // Send message to inject script to run debug
    window.postMessage({
      type: 'CF_BYPASS_RUN_DEBUG',
      url: window.location.href
    }, '*');
    
    // Also run local debug info
    console.log('=== CF Bypass: Content Script Debug Information ===');
    console.log('URL:', window.location.href);
    console.log('Detected captchas:', this.detectedCaptchas.size);
    console.log('Bypass in progress:', this.bypassInProgress);
    
    // List all detected captchas
    this.detectedCaptchas.forEach((captcha, id) => {
      console.log(`Captcha ${id}:`, {
        type: captcha.type,
        sitekey: captcha.sitekey,
        source: captcha.source || 'unknown',
        element: captcha.element
      });
    });
    
    // Re-run detection
    this.detectAllCaptchas();
  }

  // Handler for disabling JS hooks from popup
  disableJSHooks() {
    console.log('CF Bypass: Disabling JS hooks from popup...');
    
    this.jsHooksEnabled = false;
    
    // Send message to inject script to disable hooks
    window.postMessage({
      type: 'CF_BYPASS_DISABLE_HOOKS',
      url: window.location.href
    }, '*');
  }

  // Handler for enabling JS hooks from popup
  enableJSHooks() {
    console.log('CF Bypass: Enabling JS hooks from popup...');
    
    this.jsHooksEnabled = true;
    
    // Send message to inject script to enable hooks
    window.postMessage({
      type: 'CF_BYPASS_ENABLE_HOOKS',
      url: window.location.href
    }, '*');
  }

  // 更新安全模式设置
  updateSafeMode(safeMode) {
    console.log('CF Bypass: Updating safe mode:', safeMode);
    
    // 通知inject script更新安全模式
    window.postMessage({
      type: 'CF_BYPASS_UPDATE_SAFE_MODE',
      safeMode: safeMode,
      url: window.location.href
    }, '*');
  }

  // 手动提交功能
  manualSubmit() {
    console.log('CF Bypass: Manual submit triggered from popup');
    
    // 强制触发表单提交
    this.triggerFormSubmission();
    
    // 也通知inject script进行提交
    window.postMessage({
      type: 'CF_BYPASS_MANUAL_SUBMIT',
      url: window.location.href
    }, '*');
  }
  
  handleBeaconDetected(data) {
    const { beaconData, scriptSrc } = data;
    
    console.log('CF Bypass: Processing Cloudflare beacon:', beaconData);
    
    if (beaconData.token) {
      // 这个token可能用于后续的验证码生成
      // 监听相关的网络请求或DOM变化
      console.log('CF Bypass: Beacon token found, monitoring for captcha...');
      
      // 延迟检测，等待可能的验证码加载
      setTimeout(() => {
        this.detectAllCaptchas();
      }, 2000);
      
      setTimeout(() => {
        this.detectAllCaptchas();
      }, 5000);
    }
  }
  
  handleChallengeRedirect(data) {
    const { sitekey, challengeUrl } = data;
    
    console.log(`CF Bypass: Challenge redirect detected - sitekey: ${sitekey}`);
    
    if (sitekey) {
      const captchaId = `redirect-turnstile-${sitekey}`;
      
      if (!this.detectedCaptchas.has(captchaId)) {
        // 创建虚拟元素来代表这个验证码
        const virtualElement = document.createElement('div');
        virtualElement.setAttribute('data-sitekey', sitekey);
        virtualElement.setAttribute('data-source', 'challenge-redirect');
        
        this.detectedCaptchas.set(captchaId, {
          type: 'cftoken',
          element: virtualElement,
          sitekey: sitekey,
          url: window.location.href,
          source: 'challenge-redirect',
          challengeUrl: challengeUrl
        });
        
        console.log('CF Bypass: Triggering bypass for redirect-detected Turnstile');
        this.triggerBypass('cftoken', sitekey, virtualElement);
      }
    }
  }
  
  handleNetworkSitekey(data) {
    const { sitekey, requestUrl } = data;
    
    console.log(`CF Bypass: Network sitekey detected - sitekey: ${sitekey}`);
    
    if (sitekey) {
      const captchaId = `network-turnstile-${sitekey}`;
      
      if (!this.detectedCaptchas.has(captchaId)) {
        // 创建虚拟元素
        const virtualElement = document.createElement('div');
        virtualElement.setAttribute('data-sitekey', sitekey);
        virtualElement.setAttribute('data-source', 'network-request');
        
        this.detectedCaptchas.set(captchaId, {
          type: 'cftoken',
          element: virtualElement,
          sitekey: sitekey,
          url: window.location.href,
          source: 'network-request',
          requestUrl: requestUrl
        });
        
        console.log('CF Bypass: Triggering bypass for network-detected Turnstile');
        this.triggerBypass('cftoken', sitekey, virtualElement);
      }
    }
  }
  
  handleConsoleWebsiteKey(data) {
    const { websiteKey, consoleOutput } = data;
    
    console.log(`CF Bypass: Console websiteKey detected - key: ${websiteKey}`);
    
    if (websiteKey) {
      const captchaId = `console-turnstile-${websiteKey}`;
      
      if (!this.detectedCaptchas.has(captchaId)) {
        // 创建虚拟元素
        const virtualElement = document.createElement('div');
        virtualElement.setAttribute('data-sitekey', websiteKey);
        virtualElement.setAttribute('data-source', 'console-output');
        
        this.detectedCaptchas.set(captchaId, {
          type: 'cftoken',
          element: virtualElement,
          sitekey: websiteKey,
          url: window.location.href,
          source: 'console-output',
          consoleOutput: consoleOutput
        });
        
        console.log('CF Bypass: Triggering bypass for console-detected websiteKey');
        this.triggerBypass('cftoken', websiteKey, virtualElement);
      }
    }
  }
  
  handleManualWebsiteKey(data) {
    const { websiteKey } = data;
    
    console.log(`CF Bypass: Manual websiteKey set - key: ${websiteKey}`);
    
    if (websiteKey) {
      const captchaId = `manual-turnstile-${websiteKey}`;
      
      if (!this.detectedCaptchas.has(captchaId)) {
        // 创建虚拟元素
        const virtualElement = document.createElement('div');
        virtualElement.setAttribute('data-sitekey', websiteKey);
        virtualElement.setAttribute('data-source', 'manual-input');
        
        this.detectedCaptchas.set(captchaId, {
          type: 'cftoken',
          element: virtualElement,
          sitekey: websiteKey,
          url: window.location.href,
          source: 'manual-input'
        });
        
        console.log('CF Bypass: Triggering bypass for manually set websiteKey');
        this.triggerBypass('cftoken', websiteKey, virtualElement);
      }
    }
  }
  
  handleClickDetected(data) {
    const { sitekey, clickedElement, clickPosition } = data;
    
    console.log(`CF Bypass: Click-detected sitekey - key: ${sitekey}`);
    console.log('CF Bypass: Click position:', clickPosition);
    
    if (sitekey) {
      const captchaId = `click-turnstile-${sitekey}`;
      
      if (!this.detectedCaptchas.has(captchaId)) {
        // 使用实际点击的元素或创建虚拟元素
        let targetElement = clickedElement;
        if (!targetElement) {
          targetElement = document.createElement('div');
          targetElement.setAttribute('data-sitekey', sitekey);
          targetElement.setAttribute('data-source', 'user-click');
        }
        
        this.detectedCaptchas.set(captchaId, {
          type: 'cftoken',
          element: targetElement,
          sitekey: sitekey,
          url: window.location.href,
          source: 'user-click',
          clickPosition: clickPosition
        });
        
        console.log('CF Bypass: Triggering bypass for click-detected captcha');
        this.triggerBypass('cftoken', sitekey, targetElement);
        
        // 在点击位置显示提示
        if (clickPosition) {
          this.showClickFeedback(clickPosition.x, clickPosition.y);
        }
      }
    }
  }
  
  // 在点击位置显示反馈
  showClickFeedback(x, y) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: #007cba;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 999999;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transform: translate(-50%, -100%);
      margin-top: -10px;
    `;
    feedback.textContent = '🎯 CF Bypass: 验证码已检测到，正在绕过...';
    
    document.body.appendChild(feedback);
    
    // 3秒后移除提示
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 3000);
  }
  
  handleForceDetected(data) {
    const { sitekey, element } = data;
    
    console.log(`CF Bypass: Force-detected sitekey - key: ${sitekey}`);
    
    if (sitekey) {
      const captchaId = `force-turnstile-${sitekey}`;
      
      if (!this.detectedCaptchas.has(captchaId)) {
        this.detectedCaptchas.set(captchaId, {
          type: 'cftoken',
          element: element,
          sitekey: sitekey,
          url: window.location.href,
          source: 'force-search'
        });
        
        console.log('CF Bypass: Triggering bypass for force-detected captcha');
        this.triggerBypass('cftoken', sitekey, element);
      }
    }
  }
  
  handleTurnstileRender(data) {
    const { container, sitekey, params } = data;
    
    if (sitekey) {
      console.log(`CF Bypass: Turnstile detected via JavaScript hook - sitekey: ${sitekey}`);
      
      // 查找容器元素
      let containerElement;
      if (typeof container === 'string') {
        containerElement = document.querySelector(container);
      } else {
        containerElement = container;
      }
      
      if (containerElement) {
        const captchaId = `js-turnstile-${sitekey}`;
        
        if (!this.detectedCaptchas.has(captchaId)) {
          this.detectedCaptchas.set(captchaId, {
            type: 'cftoken',
            element: containerElement,
            sitekey: sitekey,
            url: window.location.href,
            source: 'javascript-hook'
          });
          
          // 立即触发绕过
          this.triggerBypass('cftoken', sitekey, containerElement);
        }
      }
    }
  }
  
  handleTurnstileRendered(data) {
    const { container, sitekey, widgetId } = data;
    
    // 再次检测确保元素已完全渲染
    setTimeout(() => {
      this.detectAllCaptchas();
    }, 1000);
  }

  async getCurrentTabId() {
    // 不需要获取tab ID，直接使用chrome.runtime.sendMessage
    return null;
  }
}

// 初始化检测器
const captchaDetector = new CaptchaDetector();

// 将检测器暴露到全局，让框架事件监听器可以访问
window.captchaDetector = captchaDetector;