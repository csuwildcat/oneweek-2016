
(function(){

  var lastState;
  var stripDomain = /(.*?:\/\/.+?\/)|([#?].+)/g;
  var stripSlashes = /(^\/)|(\/$)/g;
  localStorage.xtagHistoryIndex = localStorage.xtagHistoryIndex || 0;

  function splitPath(path){
    path = path.replace(stripDomain, '').replace(stripSlashes, '').split('/');
    return path.length ? path : ['/'];
  }

  function getPath(paths, path, obj){
    var steps = splitPath(path);
    var item = steps.reduce(function(o, k){
      return o[k] = o[k] || { _entry: {} }
    }, paths);
    return item._entry = obj || item._entry;
  }

  function callPath(paths, path, fn){
    var steps = splitPath(path);
    var last = steps.pop();
    var obj = steps.reduce(function(o, k){
      if (k) {
        var item = o[k] = o[k] || { _entry: {} };
        fn(item._entry);
        return item;
      }
    }, paths)[last];
    if (obj && obj._entry) fn(obj._entry, true);
  }

  var initPop = PopStateEvent.prototype.initPopStateEvent;
  function firePop(state){
    var event;
    if (initPop) {
      event = document.createEvent('PopStateEvent');
      event.initPopStateEvent('popstate', true, true, state);
    }
    else {
      event = new PopStateEvent('popstate', { state: state, bubbles: true, cancelable: true })
    }
    window.dispatchEvent(event);
  }

  function setTitle(title){
    if (title) document.querySelector('title').innerHTML = title;
  }

  function setIndex(obj){
    if (!obj.index) obj.index = ++localStorage.xtagHistoryIndex;
  }

  xtag.history = {
    paths: {},
    push: function(obj, merge, force){
      if (!force && obj.path == location.pathname) return;
      if (merge) obj = xtag.merge({}, history.state || {}, obj);
      setIndex(obj);
      history.pushState(obj, obj.title || null, obj.path);
      firePop(obj);
      setTitle(obj.title);
    },
    replace: function(obj, pop){
      obj = xtag.merge({}, history.state || {}, obj);
      setIndex(obj);
      history.replaceState(obj, obj.title || null, obj.path);
      if (pop) firePop(obj);
      setTitle(obj.title);
    },
    addPath: function(path, obj){
      getPath(this.paths, path, obj);
      if (path == location.pathname) {
          var docState = document.readyState;
          if (docState != 'loading') this.replace({
            path: path,
            title: obj.title
          }, true);
      }
    },
    addPaths: function(obj){
      for (var z in obj) this.addPath(z, obj[z]);
    },
    loadState: function(){
      var self = this;
      var state = history.state || {};
      var title = state.title;
      state.direction = state && state.index > (lastState && lastState.index) ? 1 : -1;
      callPath(this.paths, location.href, function(entry, call){
        if (!title) state.title = entry.title;
        if (call || entry.chain) entry.action.call(self, state, lastState || state);
      });
      setTitle(state.title);
      lastState = state;
      if (window.ga) {
        ga('set', 'page', location.pathname);
        ga('send', 'pageview');
      }
    }
  }

  document.addEventListener('WebComponentsReady', function(){
    if (history.state) xtag.history.loadState();
    else xtag.history.replace({
      path: location.href,
      title: document.title
    }, true)
  });

  window.addEventListener('popstate', function(e){
    xtag.history.loadState();
  });

})();

(function(){

  var globalMenu = document.getElementById('global_menu');

  var pages = {};
  ['overview', 'system', 'code', 'community'].forEach(function(name){
    pages[name] = document.querySelector('[page="' + name + '"]');
  });

  function switchPage(page){
    console.log(page);
    pages[page].show(true);
    xtag.query(document, 'x-action[data-page]').forEach(function(action){
      if (action.getAttribute('data-page') == page) action.setAttribute('selected', '');
      else action.removeAttribute('selected');
    });
  }

  xtag.history.addPaths({
    '/overview': {
      action: function(){
        switchPage('overview');
      }
    },
    '/system': {
      action: function(){
        switchPage('system');
      }
    },
    '/code': {
      action: function(){
        switchPage('code');
      }
    },
    '/community':  {
      action: function(){
        switchPage('community');
      }
    }
  });

  xtag.addEvents(document, {
    pagechange: function(event){
      globalMenu.hide();
      var page = event.target.getAttribute('data-page');
      xtag.history.push({
        path: '/' + page
      }, true);
    }
  });

  var diagram = document.getElementById('diagram');
  xtag.addEvents(diagram, {
    'tap:delegate([diagram-group])': function(){
      var group = this.getAttribute('diagram-group');
      diagram.setAttribute('diagram-highlight', group);
    }
  });

  function fetchGithubContent(url, success, error){
    var cache = localStorage[url];
    if (cache) {
      cache = JSON.parse(cache);
      if (new Date().getTime() - cache.expiry > 3600000) cache = false;
    }
    if (window.noFetchCaching || !cache) {
      fetch(url).then(function(response){
        return response.text();
      }).then(function(content){
        localStorage[url] = JSON.stringify({
          expiry: new Date().getTime(),
          content: content
        });
        success(content);
      }).catch(function(e){
        console.log(e);
        if (error) error(e)
      });
    }
    else {
      success(cache.content);
    }
  }

  var namesMarkdown = document.getElementById('system_names_markdown');
  var usersMarkdown = document.getElementById('system_users_markdown');
  var containersMarkdown = document.getElementById('system_containers_markdown');

  window.addEventListener('hashchange', function(){
    switch(location.hash) {
      case '#system-names':
        pages.system.setAttribute('content', 'names');
        fetchGithubContent('https://cdn.rawgit.com/blockchain-identity/blockchain-identity.github.io/master/content/name-layer.md', function(content){
          namesMarkdown.render(content);
          namesMarkdown.setAttribute('loaded', '');
        });
      break;

      case '#system-users':
        pages.system.setAttribute('content', 'users');
        fetchGithubContent('https://cdn.rawgit.com/blockchain-identity/blockchain-identity.github.io/master/content/name-layer.md', function(content){
          usersMarkdown.render(content);
          usersMarkdown.setAttribute('loaded', '');
        });
      break;

      case '#system-containers':
        pages.system.setAttribute('content', 'containers');
        fetchGithubContent('https://cdn.rawgit.com/blockchain-identity/blockchain-identity.github.io/master/content/name-layer.md', function(content){
          containersMarkdown.render(content);
          containersMarkdown.setAttribute('loaded', '');
        });
      break;
    }
  }, false);

})();
