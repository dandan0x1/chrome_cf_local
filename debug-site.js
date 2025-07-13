// 网站特定调试工具
// 用于调试特定网站的验证码检测问题

class SiteSpecificDebugger {
  constructor() {
    this.siteName = this.detectSite();
    this.debugMode = true;
    console.log(`CF Bypass: Site-specific debugger loaded for ${this.siteName}`);
  }

  detectSite() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('nodepay.ai')) return 'nodepay';
    if (hostname.includes('turnstile')) return 'turnstile-demo';
    return 'unknown';
  }

  debugNodepay() {
    console.log('=== CF Bypass: NodePay.ai Debug Analysis ===');
    
    // 1. 检查页面结构
    console.log('1. Page Structure Analysis:');
    console.log('- URL:', window.location.href);
    console.log('- ReadyState:', document.readyState);
    console.log('- Title:', document.title);
    
    // 2. 检查所有可能的验证码相关元素
    console.log('2. Captcha Element Search:');
    
    const selectors = [
      '.cf-turnstile',
      '[data-sitekey]',
      '[data-site-key]',
      '.h-captcha',
      '.g-recaptcha',
      '[class*="captcha"]',
      '[id*="captcha"]',
      '[class*="turnstile"]',
      '[id*="turnstile"]',
      '[class*="challenge"]',
      '[id*="challenge"]',
      'iframe[src*="turnstile"]',
      'iframe[src*="captcha"]',
      'iframe[src*="challenge"]'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`- Found ${elements.length} elements matching "${selector}":`, elements);
        elements.forEach((el, index) => {
          console.log(`  Element ${index}:`, {
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            sitekey: el.getAttribute('data-sitekey'),
            siteKey: el.getAttribute('data-site-key'),
            src: el.src,
            visible: this.isVisible(el),
            rect: el.getBoundingClientRect()
          });
        });
      }
    });
    
    // 3. 检查脚本标签中的验证码配置
    console.log('3. Script Analysis:');
    const scripts = document.querySelectorAll('script');
    scripts.forEach((script, index) => {
      const content = script.textContent || script.innerHTML;
      if (content && (content.includes('turnstile') || 
                     content.includes('captcha') || 
                     content.includes('sitekey') ||
                     content.includes('site_key'))) {
        console.log(`- Script ${index} contains captcha references:`, {
          src: script.src,
          contentPreview: content.substring(0, 200) + '...'
        });
        
        // 提取可能的sitekey
        const sitekeyMatches = content.match(/['""]([0-9A-Za-z_-]{20,})['"]/g);
        if (sitekeyMatches) {
          console.log('  Possible sitekeys:', sitekeyMatches);
        }
      }
    });
    
    // 4. 检查iframe
    console.log('4. Iframe Analysis:');
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe, index) => {
      console.log(`- Iframe ${index}:`, {
        src: iframe.src,
        id: iframe.id,
        className: iframe.className,
        visible: this.isVisible(iframe)
      });
    });
    
    // 5. 检查网络请求
    console.log('5. Network Monitoring Setup:');
    this.monitorNetworkRequests();
    
    // 6. 检查DOM变化
    console.log('6. DOM Mutation Monitoring:');
    this.monitorDOMChanges();
  }

  isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  monitorNetworkRequests() {
    // Hook fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (typeof url === 'string' && 
          (url.includes('turnstile') || 
           url.includes('captcha') || 
           url.includes('challenge'))) {
        console.log('CF Bypass Debug: Captcha-related fetch request:', url);
      }
      return originalFetch.apply(this, args);
    };

    // Hook XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === 'string' && 
          (url.includes('turnstile') || 
           url.includes('captcha') || 
           url.includes('challenge'))) {
        console.log('CF Bypass Debug: Captcha-related XHR request:', method, url);
      }
      return originalOpen.apply(this, arguments);
    };
  }

  monitorDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 检查新添加的元素是否包含验证码
              if (this.containsCaptchaKeywords(node)) {
                console.log('CF Bypass Debug: Captcha-related element added:', node);
                this.analyzeElement(node);
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  containsCaptchaKeywords(element) {
    const text = element.textContent || '';
    const className = element.className || '';
    const id = element.id || '';
    
    const keywords = ['turnstile', 'captcha', 'challenge', 'verification'];
    
    return keywords.some(keyword => 
      text.toLowerCase().includes(keyword) ||
      className.toLowerCase().includes(keyword) ||
      id.toLowerCase().includes(keyword)
    );
  }

  analyzeElement(element) {
    console.log('CF Bypass Debug: Element analysis:', {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      textContent: element.textContent?.substring(0, 100),
      attributes: Array.from(element.attributes).map(attr => ({
        name: attr.name,
        value: attr.value
      })),
      children: element.children.length,
      visible: this.isVisible(element)
    });
  }

  // 手动触发验证码检测
  manualCaptchaDetection() {
    console.log('CF Bypass Debug: Manual captcha detection triggered');
    
    // 尝试找到所有可能的验证码元素
    const allElements = document.querySelectorAll('*');
    const potentialCaptchas = [];
    
    allElements.forEach(element => {
      const hasDataSitekey = element.hasAttribute('data-sitekey') || element.hasAttribute('data-site-key');
      const hasCaptchaClass = /captcha|turnstile|challenge/i.test(element.className);
      const hasCaptchaId = /captcha|turnstile|challenge/i.test(element.id);
      
      if (hasDataSitekey || hasCaptchaClass || hasCaptchaId) {
        potentialCaptchas.push(element);
      }
    });
    
    console.log('CF Bypass Debug: Found potential captcha elements:', potentialCaptchas);
    
    return potentialCaptchas;
  }
}

// 根据网站类型进行特定调试
const siteDebugger = new SiteSpecificDebugger();

// 页面加载完成后运行调试
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (siteDebugger.siteName === 'nodepay') {
        siteDebugger.debugNodepay();
      }
    }, 2000);
  });
} else {
  setTimeout(() => {
    if (siteDebugger.siteName === 'nodepay') {
      siteDebugger.debugNodepay();
    }
  }, 2000);
}

// 暴露到全局供手动调用
window.siteDebugger = siteDebugger;

console.log('CF Bypass Debug: Site debugger loaded. Use window.siteDebugger.manualCaptchaDetection() for manual detection.');