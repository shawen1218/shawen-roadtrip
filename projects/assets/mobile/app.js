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
          return oldMap[d] || { date: d, destination: '', activity: '', transport: '', accommodation_name: '', accommodation_cost: '' };
        });
      }
    } else {
      state.segments = days.map(function(d){
        return { date: d, destination: '', activity: '', transport: '', accommodation_name: '', accommodation_cost: '' };
      });
      // 第一天目的地默认填目的地
      if(state.segments.length > 0) state.segments[0].destination = state.destination;
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

    card.innerHTML = '<h3>Day ' + dayNum + ' · ' + formatDate(dateStr) + ' ' + wd + '</h3>' +
      '<div class="segment-row">' +
        '<label>目的地<input type="text" class="seg-dest" value="' + (seg.destination||'') + '" placeholder="当天所在城市"></label>' +
      '</div>' +
      '<div class="segment-row">' +
        '<label>活动安排<textarea class="seg-activity" placeholder="如：上午游览故宫，下午逛王府井">' + (seg.activity||'') + '</textarea></label>' +
      '</div>' +
      '<div class="segment-row">' +
        '<label>交通方式<input type="text" class="seg-transport" value="' + (seg.transport||'') + '" placeholder="如：高铁G123 08:00-12:00"></label>' +
      '</div>' +
      '<div class="segment-footer">' +
        '<label>住宿名称<input type="text" class="seg-hotel" value="' + (seg.accommodation_name||'') + '" placeholder="酒店/民宿名称"></label>' +
        '<label>住宿费用<input type="text" class="seg-hotel-cost" value="' + (seg.accommodation_cost||'') + '" placeholder="如：300"></label>' +
      '</div>';

    // 绑定输入事件
    var inputs = card.querySelectorAll('input, textarea');
    inputs.forEach(function(inp){
      inp.addEventListener('input', function(){
        updateSegmentFromCard(card, idx);
      });
    });

    return card;
  }

  function updateSegmentFromCard(card, idx){
    if(!state.segments[idx]) return;
    state.segments[idx].destination = card.querySelector('.seg-dest').value;
    state.segments[idx].activity = card.querySelector('.seg-activity').value;
    state.segments[idx].transport = card.querySelector('.seg-transport').value;
    state.segments[idx].accommodation_name = card.querySelector('.seg-hotel').value;
    state.segments[idx].accommodation_cost = card.querySelector('.seg-hotel-cost').value;
    saveToLocal();
  }

  function initPage2(){
    // 返回按钮
    $('#backBtn').addEventListener('click', function(){ showPage('page1'); });

    // 生成计划图
    $('#generateImageBtn').addEventListener('click', function(){
      collectSegments();
      generatePoster();
    });

    // 进入看板
    $('#toPage3Btn').addEventListener('click', function(){
      collectSegments();
      // 显示加载动画
      var loadingModal = $('#aiLoadingModal');
      loadingModal.classList.remove('hidden-modal');

      setTimeout(function(){
        buildPlanData();
        renderDashboard();
        loadingModal.classList.add('hidden-modal');
        showPage('page3');
      }, 1200);
    });
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

    // 小组件
    var widgets = '<div class="page3-widgets">';
    // 天气占位
    widgets += '<div class="page3-widget weather-card"><div class="widget-label">🌤️ 天气</div>';
    if(day.current_city && day.current_city !== '待定'){
      widgets += '<div class="weather-main">' + day.current_city + '</div>';
      widgets += '<div class="weather-sub">出行前可查看当地天气预报</div>';
    } else {
      widgets += '<div class="widget-placeholder">未指定目的地</div>';
    }
    widgets += '</div>';

    // 费用记账
    widgets += buildExpenseWidget(day.date);

    widgets += '</div>';

    card.innerHTML = header + timeBlock + warnings + dataBlock + widgets;
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

    var wallpaperUrls = [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80'
    ];
    var wallpaper = wallpaperUrls[Math.floor(Math.random() * wallpaperUrls.length)];

    var html = '<div class="luxury-poster-card" style="background-image:url(' + wallpaper + ')">';
    html += '<div class="poster-overlay-veil"></div>';

    // Header
    html += '<div class="luxury-poster-header">';
    html += '<div><div class="poster-geo-heading">' + route + '</div>';
    html += '<div class="poster-meta-badge">' + days.length + '天 · ' + state.groupSize + '人</div>';
    html += '<div class="poster-time-sub">' + dateRange + '</div></div>';
    html += '<div class="poster-centered-brand">';
    html += '<div class="poster-badge-title"><span class="poster-brand-title" style="font-size:14px;color:#ff88aa;font-weight:800">莎温</span><span style="font-size:12px;color:#334155;font-weight:300;margin-left:2px">路书</span></div>';
    html += '<div class="poster-brand-subtitle">VINEYARD NOTE</div>';
    html += '</div></div>';

    // Body
    html += '<div class="luxury-poster-body">';
    days.forEach(function(seg, idx){
      var dayNum = idx + 1;
      html += '<div class="poster-segment-card-node">';
      html += '<div class="poster-main-title">DAY ' + dayNum + ' · ' + formatDate(seg.date) + '</div>';
      if(seg.destination) html += '<div class="poster-route-heading" style="margin:8px 0 4px">' + seg.destination + '</div>';
      if(seg.activity) html += '<div class="poster-card-detail-text">' + seg.activity + '</div>';
      if(seg.transport) html += '<div class="poster-card-meta" style="margin-top:4px">🚄 ' + seg.transport + '</div>';
      if(seg.accommodation_name) html += '<div class="poster-card-meta">🏨 ' + seg.accommodation_name + (seg.accommodation_cost ? ' (' + seg.accommodation_cost + '元)' : '') + '</div>';
      html += '</div>';
    });

    html += '<div class="poster-footer-watermark" style="text-align:center;margin-top:12px">— 莎温路书 · 你的专属旅行定制 —</div>';
    html += '</div></div>';

    return html;
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
