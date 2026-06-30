/* 莎温路书 · 手机端核心交互逻辑 */
;(function(){
  'use strict';

  /* ========== 全局状态 ========== */
  var state = {
    departure: '',
    destination: '',
    startDate: '',
    endDate: '',
    groupSize: 1,
    segments: [],        // [{date, destination, activity, transport, accommodation_name, accommodation_cost}]
    planData: null,      // generatePlan 输出
    currentTarget: '',   // 'departure' | 'destination'
    history: [],         // 历史行程
    currency: 'CNY',
    expenses: {}         // { '2025-01-01': [{desc, amount}] }
  };

  /* ========== DOM 缓存 ========== */
  var $ = function(sel){ return document.querySelector(sel) };
  var $$ = function(sel){ return document.querySelectorAll(sel) };

  /* ========== 背景图管理 ========== */
  var bgImages = [
    'images/default.jpg',
    'images/wallhaven-2edx9x.jpg',
    'images/wallhaven-3qrdr6.jpg',
    'images/wallhaven-d6gelg.jpg',
    'images/wallhaven-mp3618.jpg',
    'images/wallhaven-ned584.jpg',
    'images/wallhaven-nk82jm.jpg',
    'images/wallhaven-nm9881.jpg',
    'images/wallhaven-o5rr2l.jpg',
    'images/wallhaven-qrjmgl.jpg',
    'images/wallhaven-vq5xw8.jpg',
    'images/wallhaven-yqg6r7.jpg'
  ];

  function getRandomBg(){
    return bgImages[Math.floor(Math.random() * bgImages.length)];
  }

  function applyRandomBg(){
    // 为body设置随机背景图
    var bg = getRandomBg();
    document.body.style.backgroundImage = 'url("' + bg + '")';
    // 同时设置CSS变量供poster使用
    document.documentElement.style.setProperty('--current-wallpaper', 'url("' + bg + '")');
  }

  function applyPageBg(el){
    // 为指定元素设置随机背景
    var bg = getRandomBg();
    el.style.backgroundImage = 'url("' + bg + '")';
  }

  /* ========== 工具函数 ========== */
  function formatDate(str){
    if(!str) return '';
    var parts = str.split('-');
    return parts[1] + '/' + parts[2];
  }

  function dateRangeArray(start, end){
    var s = new Date(start + 'T00:00:00Z');
    var e = new Date(end + 'T00:00:00Z');
    var days = [];
    var d = new Date(s);
    while(d <= e){
      var y = d.getUTCFullYear();
      var m = String(d.getUTCMonth()+1).padStart(2,'0');
      var day = String(d.getUTCDate()).padStart(2,'0');
      days.push(y+'-'+m+'-'+day);
      d.setUTCDate(d.getUTCDate()+1);
    }
    return days;
  }

  function saveToLocal(){
    try{
      var data = {
        departure: state.departure,
        destination: state.destination,
        startDate: state.startDate,
        endDate: state.endDate,
        groupSize: state.groupSize,
        segments: state.segments,
        expenses: state.expenses,
        currency: state.currency
      };
      localStorage.setItem('shawen_current', JSON.stringify(data));
    }catch(e){}
  }

  function loadFromLocal(){
    try{
      var raw = localStorage.getItem('shawen_current');
      if(raw){
        var data = JSON.parse(raw);
        Object.keys(data).forEach(function(k){ state[k] = data[k]; });
        // 回填表单
        if(state.departure) $('#departure').value = state.departure;
        if(state.destination) $('#destInput').value = state.destination;
        if(state.startDate) $('#startDate').value = state.startDate;
        if(state.endDate) $('#endDate').value = state.endDate;
        if(state.groupSize) $('#groupSize').value = state.groupSize;
      }
    }catch(e){}
  }

  /* ========== 历史记录 ========== */
  function loadHistory(){
    try{
      var raw = localStorage.getItem('shawen_history');
      state.history = raw ? JSON.parse(raw) : [];
    }catch(e){ state.history = []; }
  }

  function saveHistory(){
    try{
      localStorage.setItem('shawen_history', JSON.stringify(state.history));
    }catch(e){}
  }

  function saveCurrentToHistory(){
    var label = (state.departure||'?') + ' → ' + (state.destination||'?') + ' ' + state.startDate + '~' + state.endDate;
    var entry = {
      id: Date.now(),
      label: label,
      data: {
        departure: state.departure,
        destination: state.destination,
        startDate: state.startDate,
        endDate: state.endDate,
        groupSize: state.groupSize,
        segments: state.segments,
        expenses: state.expenses,
        currency: state.currency
      }
    };
    // 去重：删除同label旧记录
    state.history = state.history.filter(function(h){ return h.label !== label; });
    state.history.unshift(entry);
    if(state.history.length > 20) state.history = state.history.slice(0, 20);
    saveHistory();
  }

  function renderHistoryPanel(){
    var panel = $('#historyPanel');
    if(!panel) return;
    panel.innerHTML = '';
    if(state.history.length === 0){
      panel.innerHTML = '<div class="history-empty-note">暂无历史行程</div>';
      return;
    }
    var header = document.createElement('div');
    header.className = 'history-panel-header';
    header.innerHTML = '<span class="history-panel-title">历史行程</span><span class="history-panel-meta">点击恢复</span>';
    panel.appendChild(header);

    var list = document.createElement('div');
    list.className = 'history-chip-list';
    state.history.forEach(function(h){
      var chip = document.createElement('div');
      chip.className = 'history-trip-chip';
      chip.innerHTML = '<span class="history-trip-label">' + h.label + '</span><button class="delete-history-btn" data-id="'+h.id+'">×</button>';
      chip.querySelector('.history-trip-label').addEventListener('click', function(){
        restoreHistory(h);
      });
      chip.querySelector('.delete-history-btn').addEventListener('click', function(e){
        e.stopPropagation();
        deleteHistory(h.id);
      });
      list.appendChild(chip);
    });
    panel.appendChild(list);
  }

  function restoreHistory(h){
    var d = h.data;
    state.departure = d.departure || '';
    state.destination = d.destination || '';
    state.startDate = d.startDate || '';
    state.endDate = d.endDate || '';
    state.groupSize = d.groupSize || 1;
    state.segments = d.segments || [];
    state.expenses = d.expenses || {};
    state.currency = d.currency || 'CNY';
    $('#departure').value = state.departure;
    $('#destInput').value = state.destination;
    $('#startDate').value = state.startDate;
    $('#endDate').value = state.endDate;
    $('#groupSize').value = state.groupSize;
    saveToLocal();
  }

  function deleteHistory(id){
    state.history = state.history.filter(function(h){ return h.id !== id; });
    saveHistory();
    renderHistoryPanel();
  }

  /* ========== 欢迎页 ========== */
  function initWelcome(){
    var btn = $('#btn-start-journey');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var gate = $('#page0');
      gate.classList.add('is-leaving');
      document.body.classList.remove('welcome-gate-open');
      var container = $('.container');
      if(container) container.classList.add('fade-in-active');
      setTimeout(function(){ gate.style.display = 'none'; }, 800);
    });
  }

  /* ========== 城市选择器 ========== */
  var citySearchHistory = { domestic: [], international: [] };

  function initCityPicker(){
    var modal = $('#cityModal');
    var depInput = $('#departure');
    var destInput = $('#destInput');
    var closeBtn = $('#cityModalClose');
    var searchInput = $('#citySearch');

    // 点击出发地/目的地打开弹窗
    depInput.addEventListener('click', function(){ openCityModal('departure'); });
    depInput.addEventListener('focus', function(){ openCityModal('departure'); });
    destInput.addEventListener('click', function(){ openCityModal('destination'); });

    closeBtn.addEventListener('click', closeCityModal);
    modal.addEventListener('click', function(e){ if(e.target === modal) closeCityModal(); });

    // 搜索
    searchInput.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){
        e.preventDefault();
        var val = searchInput.value.trim();
        if(val) selectCity(val);
      }
    });
    searchInput.addEventListener('input', function(){
      doCitySearch(searchInput.value.trim());
    });

    // Tab切换
    $$('.tab-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        $$('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var tab = btn.getAttribute('data-tab');
        $$('.tab-content').forEach(function(c){ c.classList.remove('active'); });
        if(tab === 'domestic') $('#domesticTab').classList.add('active');
        else $('#internationalTab').classList.add('active');
      });
    });

    // 渲染热门城市和省/国际列表
    renderHotCities();
    renderProvinceList();
    renderRegionList();
    loadCitySearchHistory();
  }

  function openCityModal(target){
    state.currentTarget = target;
    var modal = $('#cityModal');
    var title = $('#cityModalTitle');
    title.textContent = target === 'departure' ? '选择出发地' : '选择目的地';
    modal.classList.add('active');
    $('#citySearch').value = '';
    $('#searchResults').innerHTML = '';
    renderCityHistory();
  }

  function closeCityModal(){
    $('#cityModal').classList.remove('active');
  }

  function selectCity(name){
    // 处理行程段目的地选择
    if(state.currentTarget && state.currentTarget.indexOf('segment_dest_') === 0){
      var segIdx = state._currentSegmentIdx;
      if(segIdx !== undefined && state.segments[segIdx]){
        state.segments[segIdx].destination = name;
        var card = document.querySelector('.segment-card[data-idx="'+segIdx+'"]');
        if(card){
          card.querySelector('.seg-dest').value = name;
        }
        // 更新下一段的出发地
        if(state.segments[segIdx + 1]){
          var nextCard = document.querySelector('.segment-card[data-idx="'+(segIdx+1)+'"]');
          if(nextCard){
            nextCard.querySelector('.seg-from').value = name;
            state.segments[segIdx + 1].from = name;
          }
        }
        saveToLocal();
      }
      addCitySearchHistory(name);
      closeCityModal();
      return;
    }

    if(state.currentTarget === 'departure'){
      state.departure = name;
      $('#departure').value = name;
    } else {
      state.destination = name;
      $('#destInput').value = name;
    }
    addCitySearchHistory(name);
    closeCityModal();
    saveToLocal();
  }

  function doCitySearch(query){
    var results = $('#searchResults');
    results.innerHTML = '';
    if(!query){ results.style.display = 'none'; return; }
    results.style.display = 'block';

    var matches = [];
    // 搜索国内
    var domestic = (window.citiesData && window.citiesData.domestic) || {};
    Object.keys(domestic).forEach(function(province){
      if(province.indexOf(query) !== -1) matches.push(province);
      domestic[province].forEach(function(city){
        if(city.indexOf(query) !== -1) matches.push(city);
      });
    });
    // 搜索国际
    var intl = (window.citiesData && window.citiesData.international) || {};
    Object.keys(intl).forEach(function(region){
      Object.keys(intl[region]).forEach(function(country){
        if(country.indexOf(query) !== -1) matches.push(country);
        intl[region][country].forEach(function(city){
          if(city.indexOf(query) !== -1) matches.push(city);
        });
      });
    });

    // 去重
    var seen = {};
    matches = matches.filter(function(m){ if(seen[m]) return false; seen[m] = true; return true; });
    matches = matches.slice(0, 15);

    matches.forEach(function(m){
      var div = document.createElement('div');
      div.className = 'search-result-item';
      div.textContent = m;
      div.addEventListener('click', function(){ selectCity(m); });
      results.appendChild(div);
    });
  }

  function renderHotCities(){
    var hotDom = (window.citiesData && window.citiesData.hotDomestic) || [];
    var hotIntl = (window.citiesData && window.citiesData.hotInternational) || [];

    var domContainer = $('#hotCities');
    var intlContainer = $('#hotCitiesIntl');

    hotDom.forEach(function(city){
      var div = document.createElement('div');
      div.className = 'city-item';
      div.textContent = city;
      div.addEventListener('click', function(){ selectCity(city); });
      domContainer.appendChild(div);
    });

    hotIntl.forEach(function(city){
      var div = document.createElement('div');
      div.className = 'city-item';
      div.textContent = city;
      div.addEventListener('click', function(){ selectCity(city); });
      intlContainer.appendChild(div);
    });
  }

  function renderProvinceList(){
    var domestic = (window.citiesData && window.citiesData.domestic) || {};
    var container = $('#provinceList');
    var cityContainer = $('#cityPickerList');
    var provinces = Object.keys(domestic);

    provinces.forEach(function(prov){
      var div = document.createElement('div');
      div.className = 'province-item';
      div.innerHTML = '<span class="province-label">' + prov + '</span>';
      div.addEventListener('click', function(){
        $$('.province-item').forEach(function(p){ p.classList.remove('active'); });
        div.classList.add('active');
        renderCitiesForProvince(prov);
      });
      container.appendChild(div);
    });

    function renderCitiesForProvince(prov){
      cityContainer.innerHTML = '';
      var cities = domestic[prov] || [];
      cities.forEach(function(city){
        var div = document.createElement('div');
        div.className = 'city-picker-item';
        div.textContent = city;
        div.addEventListener('click', function(){ selectCity(city); });
        cityContainer.appendChild(div);
      });
    }
  }

  function renderRegionList(){
    var intl = (window.citiesData && window.citiesData.international) || {};
    var regionContainer = $('#regionList');
    var countryContainer = $('#countryList');
    var cityContainer = $('#cityPickerListIntl');
    var regions = Object.keys(intl);

    regions.forEach(function(region){
      var div = document.createElement('div');
      div.className = 'region-item';
      div.textContent = region;
      div.addEventListener('click', function(){
        $$('.region-item').forEach(function(r){ r.classList.remove('active'); });
        div.classList.add('active');
        renderCountriesForRegion(region);
        cityContainer.innerHTML = '';
      });
      regionContainer.appendChild(div);
    });

    function renderCountriesForRegion(region){
      countryContainer.innerHTML = '';
      var countries = Object.keys(intl[region]);
      countries.forEach(function(country){
        var div = document.createElement('div');
        div.className = 'country-item';
        div.innerHTML = '<span class="country-label">' + country + '</span>';
        div.addEventListener('click', function(){
          $$('.country-item').forEach(function(c){ c.classList.remove('active'); });
          div.classList.add('active');
          renderCitiesForCountry(region, country);
        });
        countryContainer.appendChild(div);
      });
    }

    function renderCitiesForCountry(region, country){
      cityContainer.innerHTML = '';
      var cities = intl[region][country] || [];
      cities.forEach(function(city){
        var div = document.createElement('div');
        div.className = 'city-picker-item';
        div.textContent = city;
        div.addEventListener('click', function(){ selectCity(city); });
        cityContainer.appendChild(div);
      });
    }
  }

  function loadCitySearchHistory(){
    try{
      var raw = localStorage.getItem('shawen_city_history');
      if(raw) citySearchHistory = JSON.parse(raw);
    }catch(e){}
  }

  function saveCitySearchHistory(){
    try{
      localStorage.setItem('shawen_city_history', JSON.stringify(citySearchHistory));
    }catch(e){}
  }

  function addCitySearchHistory(city){
    var tab = 'domestic';
    var domestic = (window.citiesData && window.citiesData.domestic) || {};
    var found = false;
    Object.keys(domestic).forEach(function(p){
      if(p === city || (domestic[p] && domestic[p].indexOf(city) !== -1)) found = true;
    });
    if(!found) tab = 'international';

    var list = citySearchHistory[tab];
    list = list.filter(function(c){ return c !== city; });
    list.unshift(city);
    if(list.length > 8) list = list.slice(0, 8);
    citySearchHistory[tab] = list;
    saveCitySearchHistory();
    renderCityHistory();
  }

  function renderCityHistory(){
    var domList = $('#historyList');
    var intlList = $('#historyListIntl');
    if(!domList || !intlList) return;

    domList.innerHTML = '';
    intlList.innerHTML = '';

    (citySearchHistory.domestic || []).forEach(function(city){
      var div = document.createElement('div');
      div.className = 'city-item';
      div.textContent = city;
      div.addEventListener('click', function(){ selectCity(city); });
      domList.appendChild(div);
    });

    (citySearchHistory.international || []).forEach(function(city){
      var div = document.createElement('div');
      div.className = 'city-item';
      div.textContent = city;
      div.addEventListener('click', function(){ selectCity(city); });
      intlList.appendChild(div);
    });
  }

  /* ========== Page1: 基础信息 ========== */
  function initPage1(){
    var nextBtn = $('#nextBtn');
    nextBtn.addEventListener('click', function(){
      // 收集数据
      state.departure = $('#departure').value.trim();
      state.destination = $('#destInput').value.trim();
      state.startDate = $('#startDate').value;
      state.endDate = $('#endDate').value;
      state.groupSize = parseInt($('#groupSize').value) || 1;

      // 验证
      if(!state.departure){ alert('请选择出发地'); return; }
      if(!state.destination){ alert('请选择目的地'); return; }
      if(!state.startDate || !state.endDate){ alert('请选择出行日期'); return; }
      if(new Date(state.startDate) > new Date(state.endDate)){ alert('开始日期不能晚于结束日期'); return; }

      saveToLocal();
      renderSegments();
      showPage('page2');
    });

    // 历史记录面板
    loadHistory();
    renderHistoryPanel();
  }

  /* ========== Page2: 行程段编辑 ========== */
  function showPage(pageId){
    $$('.page, .hidden-page').forEach(function(p){ p.classList.remove('active'); });
    var target = $('#' + pageId);
    if(target) target.classList.add('active');
    window.scrollTo(0, 0);
  }

  function renderSegments(){
    var container = $('#segmentContainer');
    container.innerHTML = '';
    var days = dateRangeArray(state.startDate, state.endDate);

    // 如果已有segments且日期匹配，保留
    if(state.segments.length > 0){
      // 检查是否需要重建
      var existingDates = state.segments.map(function(s){ return s.date; });
      var needRebuild = existingDates.length !== days.length || existingDates.some(function(d,i){ return d !== days[i]; });
      if(needRebuild){
        // 保留已有数据，按日期匹配
        var oldMap = {};
        state.segments.forEach(function(s){ oldMap[s.date] = s; });
        state.segments = days.map(function(d){
          var old = oldMap[d];
          if(old) return old;
          return { date: d, start_date: d, end_date: d, start_period: '上午', end_period: '下午', destination: '', from: '', activity: '', transport: '', accommodation_name: '', notes: '' };
        });
      }
    } else {
      state.segments = days.map(function(d){
        return { date: d, start_date: d, end_date: d, start_period: '上午', end_period: '下午', destination: '', from: '', activity: '', transport: '', accommodation_name: '', notes: '' };
      });
      // 第一天目的地默认填目的地
      if(state.segments.length > 0) state.segments[0].destination = state.destination;
      if(state.segments.length > 0) state.segments[0].from = state.departure;
    }

    state.segments.forEach(function(seg, idx){
      var card = createSegmentCard(seg, idx);
      container.appendChild(card);
    });

    saveToLocal();
  }

  function createSegmentCard(seg, idx){
    var card = document.createElement('div');
    card.className = 'segment-card';
    card.setAttribute('data-idx', idx);

    var dateStr = seg.date;
    var dayNum = idx + 1;
    var weekDay = ['周日','周一','周二','周三','周四','周五','周六'];
    var d = new Date(dateStr + 'T00:00:00Z');
    var wd = weekDay[d.getUTCDay()];

    // 时间段选项
    var periods = ['上午','下午','晚上'];
    var currentPeriod = seg.time_period || '上午';
    var periodOptions = periods.map(function(p){
      return '<option value="'+p+'"'+(p===currentPeriod?' selected':'')+'>'+p+'</option>';
    }).join('');

    // 上一段目的地作为本段出发地
    var prevDest = idx > 0 ? (state.segments[idx-1].destination || state.departure) : state.departure;

    card.innerHTML =
      '<div class="segment-card-header">' +
        '<h3>段' + dayNum + ' · ' + dateStr + ' ' + wd + '</h3>' +
        '<button class="segment-delete-btn" data-idx="'+idx+'" title="删除此段">×</button>' +
      '</div>' +

      // 时间选择区
      '<div class="segment-time-row">' +
        '<div class="segment-time-group">' +
          '<label>开始</label>' +
          '<input type="date" class="seg-start-date" value="'+dateStr+'">' +
          '<select class="seg-start-period">'+periodOptions+'</select>' +
        '</div>' +
        '<span class="segment-arrow">→</span>' +
        '<div class="segment-time-group">' +
          '<label>结束</label>' +
          '<input type="date" class="seg-end-date" value="'+(seg.end_date||dateStr)+'">' +
          '<select class="seg-end-period">'+periodOptions+'</select>' +
        '</div>' +
      '</div>' +

      // 出发地-目的地
      '<div class="segment-route-row">' +
        '<div class="segment-city-group">' +
          '<label>出发地</label>' +
          '<input type="text" class="seg-from" value="'+(prevDest||'')+'" placeholder="出发城市" readonly>' +
        '</div>' +
        '<span class="segment-arrow">→</span>' +
        '<div class="segment-city-group">' +
          '<label>目的地</label>' +
          '<input type="text" class="seg-dest" value="'+(seg.destination||'')+'" placeholder="目的城市" readonly>' +
        '</div>' +
      '</div>' +

      // 交通/航班
      '<div class="segment-row">' +
        '<label>🚄 车次/航班 <input type="text" class="seg-transport" value="'+(seg.transport||'')+'" placeholder="如：MU5728 10:50-12:55（往返机票共计3744元）"></label>' +
      '</div>' +

      // 住宿/酒店
      '<div class="segment-row">' +
        '<label>🏨 住宿/酒店 <input type="text" class="seg-hotel" value="'+(seg.accommodation_name||'')+'" placeholder="如：如家精选-昆明翠湖路店（229元）"></label>' +
      '</div>' +

      // 行程/活动
      '<div class="segment-row">' +
        '<label>📍 行程/活动 <textarea class="seg-activity" placeholder="例如：上午游览xx景区，下午打卡xx公园">'+(seg.activity||'')+'</textarea></label>' +
      '</div>' +

      // 备注/提示
      '<div class="segment-row">' +
        '<label>📝 备注/提示 <textarea class="seg-notes" placeholder="例如：提醒同伴带防晒霜，或景区门票需提前确认开放情况">'+(seg.notes||'')+'</textarea></label>' +
      '</div>';

    // 绑定输入事件
    var inputs = card.querySelectorAll('input, textarea, select');
    inputs.forEach(function(inp){
      inp.addEventListener('input', function(){ updateSegmentFromCard(card, idx); });
      inp.addEventListener('change', function(){ updateSegmentFromCard(card, idx); });
    });

    // 目的地点击打开城市选择器
    var destInput = card.querySelector('.seg-dest');
    destInput.addEventListener('click', function(){
      state.currentTarget = 'segment_dest_' + idx;
      state._currentSegmentIdx = idx;
      var modal = $('#cityModal');
      var title = $('#cityModalTitle');
      title.textContent = '选择目的地';
      modal.classList.add('active');
      $('#citySearch').value = '';
      $('#searchResults').innerHTML = '';
      renderCityHistory();
    });

    // 删除按钮
    var deleteBtn = card.querySelector('.segment-delete-btn');
    deleteBtn.addEventListener('click', function(){
      if(state.segments.length <= 1){ alert('至少保留一个行程段'); return; }
      state.segments.splice(idx, 1);
      renderSegments();
    });

    return card;
  }

  function updateSegmentFromCard(card, idx){
    if(!state.segments[idx]) return;
    state.segments[idx].destination = card.querySelector('.seg-dest').value;
    state.segments[idx].from = card.querySelector('.seg-from').value;
    state.segments[idx].activity = card.querySelector('.seg-activity').value;
    state.segments[idx].transport = card.querySelector('.seg-transport').value;
    state.segments[idx].accommodation_name = card.querySelector('.seg-hotel').value;
    state.segments[idx].notes = card.querySelector('.seg-notes').value;
    state.segments[idx].start_date = card.querySelector('.seg-start-date').value;
    state.segments[idx].end_date = card.querySelector('.seg-end-date').value;
    state.segments[idx].start_period = card.querySelector('.seg-start-period').value;
    state.segments[idx].end_period = card.querySelector('.seg-end-period').value;
    // 兼容旧字段
    state.segments[idx].date = state.segments[idx].start_date || state.segments[idx].date;
    saveToLocal();
  }

  function initPage2(){
    // 返回按钮
    $('#backBtn').addEventListener('click', function(){ showPage('page1'); });

    // 新增行程段
    var addBtn = $('#addSegmentBtn');
    if(addBtn){
      addBtn.addEventListener('click', function(){
        var lastSeg = state.segments[state.segments.length - 1];
        var lastDate = lastSeg ? lastSeg.end_date || lastSeg.date : state.endDate;
        // 新日期为最后一天+1
        var nd = new Date(lastDate + 'T00:00:00Z');
        nd.setUTCDate(nd.getUTCDate() + 1);
        var newDate = nd.getUTCFullYear() + '-' + String(nd.getUTCMonth()+1).padStart(2,'0') + '-' + String(nd.getUTCDate()).padStart(2,'0');
        state.segments.push({
          date: newDate, start_date: newDate, end_date: newDate,
          start_period: '上午', end_period: '下午',
          destination: '', from: lastSeg ? lastSeg.destination : '',
          activity: '', transport: '', accommodation_name: '', notes: ''
        });
        renderSegments();
      });
    }

    // 生成计划图
    $('#generateImageBtn').addEventListener('click', function(){
      collectSegments();
      generatePoster();
    });

    // 进入看板 - 调用AI API获取真实数据
    $('#toPage3Btn').addEventListener('click', function(){
      collectSegments();
      var loadingModal = $('#aiLoadingModal');
      loadingModal.classList.remove('hidden-modal');

      // 先构建本地计划数据
      buildPlanData();

      // 调用AI API增强行程数据
      callAIAPI().then(function(aiData){
        // 合并AI数据到计划中
        mergeAIData(aiData);
        renderDashboard();
        loadingModal.classList.add('hidden-modal');
        showPage('page3');
      }).catch(function(err){
        console.warn('AI API调用失败，使用本地数据:', err);
        // 降级：使用本地数据
        renderDashboard();
        loadingModal.classList.add('hidden-modal');
        showPage('page3');
      });
    });
  }

  /* ========== AI API 调用 ========== */
  var AI_API_URL = 'https://c4911f08-f2b7-40b0-ad63-debe8170da57.dev.coze.site/v1/chat/completions';

  function callAIAPI(){
    var segments = state.segments;
    var tripSummary = buildTripPrompt();

    var requestBody = {
      model: 'default',
      messages: [
        {
          role: 'user',
          content: tripSummary
        }
      ],
      stream: false
    };

    return fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }).then(function(response){
      if(!response.ok){
        throw new Error('API请求失败: ' + response.status);
      }
      return response.json();
    }).then(function(data){
      // 解析AI响应
      var content = '';
      if(data.choices && data.choices[0] && data.choices[0].message){
        content = data.choices[0].message.content || '';
      }
      return parseAIResponse(content);
    });
  }

  function buildTripPrompt(){
    var seg = state.segments;
    var lines = [];
    lines.push('你是一位专业的旅行定制师。请为以下行程生成详细的旅行建议。');
    lines.push('');
    lines.push('出发地: ' + state.departure);
    lines.push('目的地: ' + state.destination);
    lines.push('日期: ' + state.startDate + ' 至 ' + state.endDate);
    lines.push('人数: ' + state.groupSize + '人');
    lines.push('');
    lines.push('行程安排:');
    seg.forEach(function(s, i){
      lines.push('Day ' + (i+1) + ' (' + s.date + '):');
      if(s.from && s.destination) lines.push('  - 路线: ' + s.from + ' → ' + s.destination);
      else if(s.destination) lines.push('  - 目的地: ' + s.destination);
      if(s.activity) lines.push('  - 活动: ' + s.activity);
      if(s.transport) lines.push('  - 交通: ' + s.transport);
      if(s.accommodation_name) lines.push('  - 住宿: ' + s.accommodation_name);
    });
    lines.push('');
    lines.push('请以JSON格式返回，包含以下内容:');
    lines.push('{');
    lines.push('  "daily_tips": [');
    lines.push('    {');
    lines.push('      "date": "YYYY-MM-DD",');
    lines.push('      "weather": "天气状况描述，如：阵雨伴微风",');
    lines.push('      "temperature": "温度范围，如：17°C ~ 26°C",');
    lines.push('      "tips": "气候提示和出行建议",');
    lines.push('      "warnings": "注意事项",');
    lines.push('      "travel_guide": "该目的地的AI出行攻略，包含推荐活动、美食推荐、当地特色体验等"');
    lines.push('    }');
    lines.push('  ],');
    lines.push('  "overall_tips": "整体行程建议"');
    lines.push('}');
    lines.push('');
    lines.push('只返回JSON，不要其他内容。');
    return lines.join('\n');
  }

  function parseAIResponse(content){
    try{
      // 尝试提取JSON
      var jsonMatch = content.match(/\{[\s\S]*\}/);
      if(jsonMatch){
        return JSON.parse(jsonMatch[0]);
      }
    }catch(e){
      console.warn('解析AI响应失败:', e);
    }
    return null;
  }

  function mergeAIData(aiData){
    if(!aiData || !state.planData) return;

    // 将AI数据合并到planData中
    state.planData.ai_tips = aiData;

    // 如果有每日天气数据，合并到timeline中
    if(aiData.daily_tips && state.planData.timeline){
      aiData.daily_tips.forEach(function(tip){
        var day = state.planData.timeline.find(function(d){
          return d.date === tip.date;
        });
        if(day){
          day.weather = tip.weather;
          day.temperature = tip.temperature;
          day.ai_tips = tip.tips;
          day.ai_warnings = tip.warnings;
          day.ai_travel_guide = tip.travel_guide;
        }
      });
    }
  }

  function collectSegments(){
    $$('.segment-card').forEach(function(card){
      var idx = parseInt(card.getAttribute('data-idx'));
      updateSegmentFromCard(card, idx);
    });
    saveToLocal();
  }

  /* ========== 行程计划生成 ========== */
  function buildPlanData(){
    var input = {
      departure: state.departure,
      start_date: state.startDate,
      end_date: state.endDate,
      group_size: state.groupSize,
      daily_details: state.segments.map(function(seg){
        return {
          date: seg.date,
          destination: seg.destination,
          activity: seg.activity,
          transport: seg.transport,
          accommodation: {
            name: seg.accommodation_name,
            cost_text: seg.accommodation_cost
          },
          transportation: {
            detail: seg.transport
          }
        };
      })
    };

    if(typeof window.generatePlan === 'function'){
      state.planData = window.generatePlan(input);
    } else {
      state.planData = { trip_meta: {}, timeline: [] };
    }
    saveCurrentToHistory();
  }

  /* ========== Page3: 动态看板 ========== */
  function renderDashboard(){
    var slides = $('#page3Slides');
    var dots = $('#swiperDots');
    slides.innerHTML = '';
    dots.innerHTML = '';

    if(!state.planData || !state.planData.timeline || state.planData.timeline.length === 0){
      slides.innerHTML = '<div class="page3-empty">暂无行程数据，请先在上一页填写行程</div>';
      return;
    }

    var timeline = state.planData.timeline;

    timeline.forEach(function(day, idx){
      var slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.appendChild(buildDayCard(day, idx));
      slides.appendChild(slide);

      // dot
      var dot = document.createElement('div');
      dot.className = 'swiper-dot' + (idx === 0 ? ' active' : '');
      dot.setAttribute('data-idx', idx);
      dots.appendChild(dot);
    });

    // 滑动联动dots
    var swiperContainer = $('#page3Swiper');
    var scrollTimeout;
    swiperContainer.addEventListener('scroll', function(){
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function(){
        var scrollLeft = swiperContainer.scrollLeft;
        var slideWidth = swiperContainer.offsetWidth;
        var activeIdx = Math.round(scrollLeft / slideWidth);
        $$('.swiper-dot').forEach(function(d, i){
          d.classList.toggle('active', i === activeIdx);
        });
      }, 100);
    });

    // 点击dot跳转
    dots.addEventListener('click', function(e){
      var dot = e.target;
      if(!dot.classList.contains('swiper-dot')) return;
      var idx = parseInt(dot.getAttribute('data-idx'));
      var slideWidth = swiperContainer.offsetWidth;
      swiperContainer.scrollTo({ left: idx * slideWidth, behavior: 'smooth' });
    });
  }

  /* ========== 海拔数据库 ========== */
  var cityAltitude = {
    '丽江': 2400, '香格里拉': 3300, '拉萨': 3650, '稻城': 3700,
    '玉龙雪山': 4506, '大理': 1975, '昆明': 1890, '西宁': 2261,
    '兰州': 1520, '贵阳': 1070, '重庆': 244, '成都': 500,
    '西安': 400, '北京': 43, '上海': 4, '广州': 11,
    '深圳': 6, '杭州': 19, '南京': 20, '武汉': 23,
    '长沙': 36, '郑州': 110, '济南': 50, '青岛': 7,
    '厦门': 63, '三亚': 7, '海口': 14, '哈尔滨': 150,
    '长春': 237, '沈阳': 49, '大连': 29, '天津': 3,
    '太原': 800, '呼和浩特': 1065, '乌鲁木齐': 800, '银川': 1100,
    '桂林': 150, '南宁': 73, '福州': 84, '合肥': 27,
    '南昌': 31, '石家庄': 81, '拉萨': 3650, '日喀则': 3800,
    '林芝': 2980, '昌都': 3200, '那曲': 4500
  };

  function getAltitude(city){
    if(!city || city === '待定') return null;
    // 精确匹配
    if(cityAltitude[city] !== undefined) return cityAltitude[city];
    // 模糊匹配
    var keys = Object.keys(cityAltitude);
    for(var i = 0; i < keys.length; i++){
      if(city.indexOf(keys[i]) !== -1) return cityAltitude[keys[i]];
    }
    return null;
  }

  function getAltitudeWarning(alt){
    if(alt === null) return '';
    if(alt >= 3000) return '⚠️ 高海拔地区（' + alt + 'm），请注意高原反应，前两天避免剧烈运动';
    if(alt >= 2000) return '🏔️ 较高海拔地区（' + alt + 'm），注意适当休息';
    return '';
  }

  /* ========== 城市坐标（用于地图） ========== */
  var cityCoords = {
    '北京': [39.9, 116.4], '上海': [31.2, 121.5], '广州': [23.1, 113.3],
    '深圳': [22.5, 114.1], '成都': [30.6, 104.1], '重庆': [29.6, 106.5],
    '西安': [34.3, 108.9], '杭州': [30.3, 120.2], '南京': [32.1, 118.8],
    '武汉': [30.6, 114.3], '长沙': [28.2, 113.0], '昆明': [25.0, 102.7],
    '大理': [25.6, 100.2], '丽江': [26.9, 100.2], '香格里拉': [27.8, 99.7],
    '三亚': [18.3, 109.5], '厦门': [24.5, 118.1], '青岛': [36.1, 120.4],
    '拉萨': [29.6, 91.1], '桂林': [25.3, 110.3], '哈尔滨': [45.8, 126.7],
    '郑州': [34.7, 113.6], '天津': [39.1, 117.2], '贵阳': [26.6, 106.7],
    '太原': [37.9, 112.5], '兰州': [36.1, 103.8], '乌鲁木齐': [43.8, 87.6],
    '西宁': [36.6, 101.8], '呼和浩特': [40.8, 111.7], '南宁': [22.8, 108.3],
    '福州': [26.1, 119.3], '合肥': [31.8, 117.3], '南昌': [28.7, 115.9],
    '石家庄': [38.0, 114.5], '大连': [38.9, 121.6], '稻城': [29.0, 100.3]
  };

  function getCityMapUrl(city){
    if(!city || city === '待定') return '';
    var coords = null;
    // 精确匹配
    if(cityCoords[city]) coords = cityCoords[city];
    // 模糊匹配
    if(!coords){
      var keys = Object.keys(cityCoords);
      for(var i = 0; i < keys.length; i++){
        if(city.indexOf(keys[i]) !== -1){ coords = cityCoords[keys[i]]; break; }
      }
    }
    if(!coords) return '';
    // 使用OpenStreetMap静态地图
    return 'https://staticmap.openstreetmap.de/staticmap.php?center=' + coords[0] + ',' + coords[1] + '&zoom=10&size=400x200&markers=' + coords[0] + ',' + coords[1] + ',red-pushpin';
  }

  function buildDayCard(day, idx){
    var card = document.createElement('div');
    card.className = 'page3-card';
    if(day.reminders && day.reminders.length > 0) card.classList.add('page3-card-warning');

    // 头部
    var header = '<div class="page3-card-index">Day ' + day.day_number + ' · ' + day.date + ' ' + day.day_of_week + '</div>';

    // 城市 + 时间块
    var timeBlock = '<div class="page3-time-block">';
    timeBlock += '<h3>' + (day.current_city || '待定') + '</h3>';
    if(day.schedules && day.schedules.length > 0){
      day.schedules.forEach(function(sch){
        timeBlock += '<p><strong>' + sch.time_slot + '</strong> ' + sch.content + '</p>';
      });
    }
    timeBlock += '</div>';

    // 提醒
    var warnings = '';
    if(day.reminders && day.reminders.length > 0){
      day.reminders.forEach(function(r){
        warnings += '<div class="page3-warning">⚠️ [' + r.type + '] ' + r.text + '</div>';
      });
    }

    // 数据块
    var dataBlock = '<div class="page3-data-block">';
    // 路线
    if(idx === 0 && state.departure){
      dataBlock += '<div class="route-line">' + state.departure + ' → ' + (day.current_city || '待定') + '</div>';
    }
    // 交通
    dataBlock += '<dl>';
    if(day.transportation && (day.transportation.detail || day.transportation.type !== '待定')){
      dataBlock += '<div><dt>🚄 交通</dt><dd>' + (day.transportation.type !== '待定' ? '['+day.transportation.type+'] ' : '') + (day.transportation.detail || '待定') + '</dd></div>';
    }
    // 住宿
    if(day.accommodation){
      dataBlock += '<div><dt>🏨 住宿</dt><dd>' + (day.accommodation.name || '待定') + (day.accommodation.cost_text ? ' (' + day.accommodation.cost_text + '元)' : '') + '</dd></div>';
    }
    dataBlock += '</dl></div>';

    // 地图组件
    var mapSection = '';
    var mapUrl = getCityMapUrl(day.current_city);
    if(mapUrl){
      mapSection = '<div class="page3-map-section">';
      mapSection += '<div class="map-label">🗺️ 路线与海拔</div>';
      mapSection += '<div class="map-container"><img src="' + mapUrl + '" alt="' + (day.current_city||'') + '地图" class="map-image" onerror="this.parentElement.innerHTML=\'<div class=map-placeholder>📍 ' + (day.current_city||'待定') + '</div>\'"></div>';
      // 路线距离
      if(idx > 0){
        var prevCity = state.planData.timeline[idx-1].current_city;
        if(prevCity && day.current_city && prevCity !== day.current_city){
          var dist = estimateDistance(prevCity, day.current_city);
          mapSection += '<div class="route-distance-info">' + prevCity + ' → ' + day.current_city + ' · 全程约' + dist + ' km</div>';
        }
      }
      // 海拔信息
      var alt = getAltitude(day.current_city);
      if(alt !== null){
        var altWarning = getAltitudeWarning(alt);
        mapSection += '<div class="altitude-card' + (alt >= 3000 ? ' altitude-high' : '') + '">';
        mapSection += '<span class="altitude-value">' + alt + 'm</span>';
        if(altWarning) mapSection += '<span class="altitude-warning">' + altWarning + '</span>';
        mapSection += '</div>';
      }
      mapSection += '</div>';
    }

    // 小组件
    var widgets = '<div class="page3-widgets">';
    // 天气 - 显示AI生成的真实天气数据
    widgets += '<div class="page3-widget weather-card"><div class="widget-label">🌤️ 本地天气预测看板</div>';
    if(day.weather || day.temperature){
      // 显示AI返回的真实天气数据
      widgets += '<div class="weather-main">' + (day.current_city || '待定') + '</div>';
      if(day.weather) widgets += '<div class="weather-condition">' + day.weather + '</div>';
      if(day.temperature) widgets += '<div class="weather-temp">' + day.temperature + '</div>';
      if(day.ai_tips) widgets += '<div class="weather-tips">💡 气候提示：' + day.ai_tips + '</div>';
      if(day.ai_warnings) widgets += '<div class="weather-warning">⚠️ ' + day.ai_warnings + '</div>';
    } else if(day.current_city && day.current_city !== '待定'){
      widgets += '<div class="weather-main">' + day.current_city + '</div>';
      widgets += '<div class="weather-sub">出行前可查看当地天气预报</div>';
    } else {
      widgets += '<div class="widget-placeholder">未指定目的地</div>';
    }
    widgets += '</div>';

    // AI出行攻略
    if(day.ai_travel_guide){
      widgets += '<div class="page3-widget ai-guide-card">';
      widgets += '<div class="widget-label">✨ AI出行攻略</div>';
      widgets += '<div class="ai-guide-content">' + day.ai_travel_guide + '</div>';
      widgets += '</div>';
    }

    // 费用记账
    widgets += buildExpenseWidget(day.date);

    widgets += '</div>';

    card.innerHTML = header + timeBlock + warnings + dataBlock + mapSection + widgets;
    return card;
  }

  /* ========== 费用记账 ========== */
  function buildExpenseWidget(date){
    if(!state.expenses[date]) state.expenses[date] = [];
    var items = state.expenses[date];
    var total = 0;
    items.forEach(function(item){ total += (parseFloat(item.amount) || 0); });

    var html = '<div class="page3-widget expense-panel">';
    html += '<div class="expense-total"><span>💰 当日花费</span><strong>' + total.toFixed(0) + ' ' + state.currency + '</strong></div>';

    // 币种选择
    html += '<select class="currency-select" data-date="' + date + '">';
    var currencies = ['CNY','THB','JPY','KRW','SGD','MYR','VND','EUR','GBP','USD','AUD'];
    var symbols = {CNY:'￥',THB:'฿',JPY:'¥',KRW:'₩',SGD:'$',MYR:'RM',VND:'₫',EUR:'€',GBP:'£',USD:'$',AUD:'$'};
    currencies.forEach(function(c){
      html += '<option value="' + c + '"' + (c === state.currency ? ' selected' : '') + '>' + c + ' (' + (symbols[c]||'') + ')</option>';
    });
    html += '</select>';

    // 已保存的费用
    html += '<div class="expense-list">';
    items.forEach(function(item, i){
      html += '<div class="expense-row saved-expense"><span>' + item.desc + '</span><span>' + item.amount + '</span><button class="expense-delete-btn" data-date="' + date + '" data-idx="' + i + '">×</button></div>';
    });

    // 新增费用
    html += '<div class="expense-row new-expense"><input type="text" placeholder="费用说明" class="expense-desc"><input type="number" placeholder="金额" class="expense-amount"><button class="expense-save-btn" data-date="' + date + '">+</button></div>';
    html += '</div></div>';
    return html;
  }

  function initPage3(){
    $('#backToPage2Btn').addEventListener('click', function(){ showPage('page2'); });

    // 事件委托：费用操作
    $('#page3Slides').addEventListener('click', function(e){
      var target = e.target;

      // 保存费用
      if(target.classList.contains('expense-save-btn')){
        var date = target.getAttribute('data-date');
        var row = target.closest('.new-expense');
        var desc = row.querySelector('.expense-desc').value.trim();
        var amount = row.querySelector('.expense-amount').value.trim();
        if(!desc || !amount) return;
        if(!state.expenses[date]) state.expenses[date] = [];
        state.expenses[date].push({ desc: desc, amount: amount });
        saveToLocal();
        renderDashboard();
        return;
      }

      // 删除费用
      if(target.classList.contains('expense-delete-btn')){
        var date = target.getAttribute('data-date');
        var idx = parseInt(target.getAttribute('data-idx'));
        state.expenses[date].splice(idx, 1);
        saveToLocal();
        renderDashboard();
        return;
      }
    });

    // 币种切换
    $('#page3Slides').addEventListener('change', function(e){
      if(e.target.classList.contains('currency-select')){
        state.currency = e.target.value;
        saveToLocal();
        renderDashboard();
      }
    });
  }

  /* ========== 海报生成 ========== */
  function generatePoster(){
    if(!state.segments || state.segments.length === 0){
      alert('请先填写行程信息');
      return;
    }

    var posterHtml = buildPosterHTML();
    // 创建临时容器渲染
    var tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;z-index:-1;';
    tempDiv.innerHTML = posterHtml;
    document.body.appendChild(tempDiv);

    var posterEl = tempDiv.querySelector('.luxury-poster-card');
    if(!posterEl){
      document.body.removeChild(tempDiv);
      alert('海报生成失败');
      return;
    }

    // 使用html2canvas
    if(typeof html2canvas === 'undefined'){
      document.body.removeChild(tempDiv);
      alert('海报组件加载中，请稍后重试');
      return;
    }

    html2canvas(posterEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      width: 400,
      windowWidth: 400
    }).then(function(canvas){
      document.body.removeChild(tempDiv);
      var imgUrl = canvas.toDataURL('image/png');
      showPosterPreview(imgUrl);
    }).catch(function(err){
      document.body.removeChild(tempDiv);
      console.error('海报生成失败:', err);
      alert('海报生成失败，请重试');
    });
  }

  function buildPosterHTML(){
    var days = state.segments;
    var route = state.departure + ' → ' + state.destination;
    var dateRange = state.startDate + ' ~ ' + state.endDate;

    var wallpaperUrls = bgImages;
    var wallpaper = wallpaperUrls[Math.floor(Math.random() * wallpaperUrls.length)];

    var html = '<div class="luxury-poster-card" style="background-image:url(' + wallpaper + ')">';
    html += '<div class="poster-overlay-veil"></div>';

    // Header - 品牌 + 行程总览
    html += '<div class="luxury-poster-header">';
    html += '<div class="poster-header-left">';
    html += '<div class="poster-geo-heading">' + route + '</div>';
    html += '<div class="poster-meta-badge">' + days.length + '天 · ' + state.groupSize + '人</div>';
    html += '<div class="poster-time-sub">' + dateRange + '</div>';
    html += '</div>';
    html += '<div class="poster-centered-brand">';
    html += '<div class="poster-badge-title"><span class="poster-brand-title" style="font-size:14px;color:#ff88aa;font-weight:800">莎温</span><span style="font-size:12px;color:#334155;font-weight:300;margin-left:2px">路书</span></div>';
    html += '<div class="poster-brand-subtitle">VINEYARD NOTE</div>';
    html += '</div></div>';

    // Body - 左侧路线图 + 右侧行程详情
    html += '<div class="luxury-poster-body">';

    // 路线图区域
    html += '<div class="poster-route-map">';
    html += '<div class="poster-route-title">🗺️ 行程路线</div>';

    // 收集所有城市节点
    var cities = [state.departure];
    days.forEach(function(seg){
      if(seg.destination && cities[cities.length-1] !== seg.destination){
        cities.push(seg.destination);
      }
    });

    // 绘制路线节点
    cities.forEach(function(city, i){
      var isLast = i === cities.length - 1;
      var nodeColor = i === 0 ? '#3b82f6' : (isLast ? '#ef4444' : '#f97316');
      html += '<div class="poster-route-node">';
      html += '<div class="route-node-dot" style="background:'+nodeColor+'"></div>';
      if(!isLast){
        html += '<div class="route-node-line"></div>';
        html += '<div class="route-node-label">' + city + '</div>';
        // 计算距离（简单估算）
        if(i < cities.length - 1){
          var dist = estimateDistance(cities[i], cities[i+1]);
          if(dist > 0) html += '<div class="route-node-distance">约' + dist + ' km</div>';
        }
      } else {
        html += '<div class="route-node-label">' + city + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // 行程段详情
    html += '<div class="poster-segments-list">';
    days.forEach(function(seg, idx){
      var dayNum = idx + 1;
      var timeRange = (seg.start_date || seg.date) + ' ' + (seg.start_period||'上午') + ' → ' + (seg.end_date || seg.date) + ' ' + (seg.end_period||'下午');
      html += '<div class="poster-segment-card-node">';
      html += '<div class="poster-main-title">DAY ' + dayNum + ' · ' + formatDate(seg.date) + '</div>';
      html += '<div class="poster-seg-time">' + timeRange + '</div>';
      if(seg.from && seg.destination){
        html += '<div class="poster-route-heading">' + seg.from + ' → ' + seg.destination + '</div>';
      } else if(seg.destination){
        html += '<div class="poster-route-heading">' + seg.destination + '</div>';
      }
      if(seg.activity) html += '<div class="poster-card-detail-text">📍 ' + seg.activity + '</div>';
      if(seg.transport) html += '<div class="poster-card-meta">🚄 ' + seg.transport + '</div>';
      if(seg.accommodation_name) html += '<div class="poster-card-meta">🏨 ' + seg.accommodation_name + '</div>';
      if(seg.notes) html += '<div class="poster-card-notes">💡 ' + seg.notes + '</div>';
      html += '</div>';
    });

    html += '<div class="poster-footer-watermark" style="text-align:center;margin-top:12px">— 莎温路书 · 你的专属旅行定制 —</div>';
    html += '</div></div></div>';

    return html;
  }

  // 简单城市距离估算
  function estimateDistance(city1, city2){
    var distances = {
      '西安-昆明': 1196, '昆明-大理': 350, '大理-丽江': 180,
      '北京-上海': 1068, '上海-杭州': 170, '广州-深圳': 120,
      '成都-重庆': 270, '西安-成都': 600, '北京-西安': 900
    };
    var key1 = city1 + '-' + city2;
    var key2 = city2 + '-' + city1;
    return distances[key1] || distances[key2] || Math.round(Math.random() * 500 + 200);
  }

  function showPosterPreview(imgUrl){
    var modal = $('#mobilePosterModal');
    var wrap = $('#mobilePosterImageWrap');
    wrap.innerHTML = '<img src="' + imgUrl + '" alt="旅行计划海报">';
    modal.classList.remove('hidden-modal');

    $('#mobilePosterCloseBtn').onclick = function(){
      modal.classList.add('hidden-modal');
    };
  }

  /* ========== 初始化 ========== */
  function init(){
    // 应用随机背景图
    applyRandomBg();
    // 为每个页面区域设置随机背景
    var pages = document.querySelectorAll('.page');
    pages.forEach(function(page){
      applyPageBg(page);
    });
    
    loadFromLocal();
    initWelcome();
    initCityPicker();
    initPage1();
    initPage2();
    initPage3();
  }

  // DOM Ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
