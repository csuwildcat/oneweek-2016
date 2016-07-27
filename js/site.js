
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
  ['start', 'sales', 'loans', 'contracts'].forEach(function(name){
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

  function formToJSON(form){
    var obj = {};
    xtag.query(form, 'input[name], select[name], textarea[name], x-medium-editor[name]').forEach(function(node){
      var name = node.name;
      var value = node.value;
      if (node.nodeName == 'INPUT'){
        switch (node.type) {
          case 'checkbox': value = node.checked; break;
          case 'date': value = new Date(value); break;
        }
      }
      if (obj[name] !== undefined){
        obj[name].push ? obj[name].push(value) : obj[name] = [obj[name], value];
      }
      else obj[name] = value;
    });
    return obj;
  }

  function clearForm(form){
    xtag.query(form, 'input:not([type="submit"])').forEach(function(input){
      input.value = null;
    });
  }

  function getData(key){
    return JSON.parse(localStorage[key] || null);
  }

  function setData(key, data){
    return localStorage[key] = JSON.stringify(data);
  }

  xtag.history.addPaths({
    '/oneweek-2016': {
      action: function(){
        switchPage('sales');
      }
    },
    '/oneweek-2016/sales': {
      action: function(){
        switchPage('sales');
      }
    },
    '/oneweek-2016/loans': {
      action: function(){
        switchPage('loans');
      }
    },
    '/oneweek-2016/contracts':  {
      action: function(){
        switchPage('contracts');
      }
    }
  });

  var saleList = document.querySelector('[page="sales"] section > ul');
  var loanList = document.querySelector('[page="loans"] section > ul');
  var contractList = document.querySelector('[page="contracts"] section > ul');

  var saleTemplate = xtag.createFragment('<li class="shadow-low" flex="row center-y"><div flex-fill>' +
    '<h4></h4>' +
    '<div><b>Product:</b> <span class="sale-product"></span></div><div><b>Weight:</b> <span class="sale-weight"></span></div><div><b>Price:</b> <span class="sale-price"></span></div>' +
  '</div><div class="sale-signature"></div></li>');

  var templateRenderers = {
    sale: function(data){
      var node = saleTemplate.cloneNode(true);
      node.firstElementChild.id = data.id;
      node.querySelector('h4').textContent = data.sale_product;
      node.querySelector('.sale-product').textContent = data.sale_buyer;
      node.querySelector('.sale-weight').textContent = data.sale_weight;
      node.querySelector('.sale-price').textContent = data.sale_price;
      if (data.sale_signature) node.querySelector('.sale-signature').setAttribute('signed', '');
      node.firstElementChild.__data__ = data;
      return node;
    }
  }

  xtag.addEvents(document, {
    pagechange: function(event){
      globalMenu.hide();
      var page = event.target.getAttribute('data-page');
      var modal = event.target.getAttribute('data-modal');
      if (modal) document.getElementById(modal).show();
      xtag.history.push({
        path: '/' + page
      }, true);
    },
    'submit:delegate(x-modal form)': function(e){
      e.preventDefault();
      console.log(e);
      var form = e.target;
      var data = formToJSON(e.target);
      switch (form.getAttribute('form-type')) {
        case 'sales':
          var sales = getData('sales') || {};
          data.id = xtag.uid();
          console.log(data);
          sales[data.id] = data;
          setData('sales', sales);
          var node = templateRenderers.sale(data);
          saleList.appendChild(node);
          clearForm(form);
          new_sale.hide();
        break;
        case 'sale-signing':
          var sale = sale_signing.__data__;
          var li = document.getElementById(sale.id);
          if (li) li.querySelector('.sale-signature').setAttribute('signed', '');
          sale.sale_signature = {};
          sale.sale_phone = data.sale_phone;
          var sales = getData('sales') || {};
          sales[sale.id] = sale;
          setData('sales', sales)
          clearForm(form);
          sale_signing.hide();
      }
    },
    'tap:delegate([page="sales"] section li)': function(){
      sale_signing.__data__ = this.__data__;
      sale_signing.show();

    }
  });

  var sales = getData('sales');

  if (sales) {
    for (z in sales) {
      var node = templateRenderers.sale(sales[z]);
      saleList.appendChild(node);
    }
  }

})();
