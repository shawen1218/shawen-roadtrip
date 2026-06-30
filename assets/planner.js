;(function(root){
  function parseNumberSumFromStrings(arr){
    var sum = 0
    if(!Array.isArray(arr)) return 0
    arr.forEach(function(s){
      if(!s) return
      var str = String(s)
      var matches = str.match(/(\d+(?:[\.,]\d+)?)/g)
      if(matches){
        matches.forEach(function(m){
          var n = parseFloat(m.replace(',', '.'))
          if(!isNaN(n)) sum += n
        })
      }
    })
    return Math.round(sum)
  }

  var highAltitudeCities = ['丽江','香格里拉','拉萨','稻城','玉龙雪山']

  var hotAttractions = {
    '北京':['故宫','天安门','颐和园'],
    '丽江':['丽江古城','玉龙雪山'],
    '成都':['宽窄巷子','锦里古街'],
    '香格里拉':['松赞林寺','普达措国家公园']
  }

  function dayOfWeek(dateStr){
    // Parse date in UTC to avoid timezone shift
    var d = new Date(dateStr + 'T00:00:00Z')
    var map = ['周日','周一','周二','周三','周四','周五','周六']
    return map[d.getUTCDay()]
  }

  function dateRange(start, end){
    // Parse dates as YYYY-MM-DD strings directly without timezone conversion
    var s = new Date(start + 'T00:00:00Z')  // Explicit UTC to avoid local tz shifts
    var e = new Date(end + 'T00:00:00Z')
    var days = []
    var d = new Date(s)
    while(d <= e){
      // Extract YYYY-MM-DD directly from the UTC date
      var year = d.getUTCFullYear()
      var month = String(d.getUTCMonth() + 1).padStart(2, '0')
      var date = String(d.getUTCDate()).padStart(2, '0')
      days.push(year + '-' + month + '-' + date)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    return days
  }

  function recommendAttractions(city){
    if(hotAttractions[city]) return hotAttractions[city].slice(0,2)
    return [city + '市中心景点', city + '美食街']
  }

  function detectTransportType(detail){
    if(!detail) return '待定'
    if(/飞机|航班/.test(detail)) return '飞机'
    if(/动车|高铁|列车|火车/.test(detail)) return '动车'
    if(/汽车|大巴|巴士/.test(detail)) return '当地交通'
    return '待定'
  }

  function generatePlan(input){
    var start = input.start_date
    var end = input.end_date
    var days = dateRange(start,end)
    var total_days = days.length
    var initial_known_cost = 0

    // extract numeric costs from daily_details
    if(Array.isArray(input.daily_details)){
      var numStrings = []
      input.daily_details.forEach(function(d){
        if(d.accommodation && d.accommodation.cost_text) numStrings.push(d.accommodation.cost_text)
        if(d.transportation && d.transportation.detail) numStrings.push(d.transportation.detail)
      })
      initial_known_cost = parseNumberSumFromStrings(numStrings)
    }

    var timeline = []
    var prevCity = input.departure || ''

    days.forEach(function(dateStr, idx){
      var dayNum = idx+1
      var raw = (input.daily_details||[]).find(function(x){return x.date===dateStr}) || {}
      // If destination not explicitly filled for this day, use "待定", not copying from previous day
      var city = raw.destination || '待定'

      var schedules = []
      if(raw.activity && raw.activity.trim()){
        var act = raw.activity.trim()
        if(/上午/.test(act) || /下午/.test(act)){
          // try split by 上午/下午
          if(/上午/.test(act)) schedules.push({time_slot:'上午',content:act})
          if(/下午/.test(act)) schedules.push({time_slot:'下午',content:act})
        } else {
          schedules.push({time_slot:'全天',content:act})
        }
      } else {
        var recs = recommendAttractions(city)
        schedules.push({time_slot:'上午',content:recs[0]})
        schedules.push({time_slot:'下午',content:recs[1]})
      }

      var accommodation = {name:'待定', cost_text:'待定'}
      if(raw.accommodation){
        accommodation.name = raw.accommodation.name || '待定'
        accommodation.cost_text = raw.accommodation.cost_text || '待定'
      } else {
        accommodation.name = city + '市中心/商圈（推荐）'
      }

      var transportation = {type:'待定', detail:raw.transport || (raw.transportation && raw.transportation.detail) || ''}
      if(raw.transportation && raw.transportation.type) transportation.type = raw.transportation.type
      else transportation.type = detectTransportType(transportation.detail)

      var reminders = []
      // cross-city transport missing
      if(city && prevCity && city!==prevCity && (!transportation.detail || transportation.detail==='')){
        reminders.push({type:'购票',text:'检测到跨城行程，未填写具体车次/航班，请及时购买车票/机票'})
      }
      // hot attractions that often require ticket
      var hotTicketList = ['玉龙雪山','布达拉宫','松赞林寺']
      if(Array.isArray(schedules)){
        schedules.forEach(function(sch){
          if(Array.isArray(hotTicketList)){
            hotTicketList.forEach(function(h){
              if(sch.content && sch.content.indexOf(h)!==-1){
                reminders.push({type:'抢票',text:'行程中包含'+h+'，建议提前预约门票或关注售票平台'})
              }
            })
          }
        })
      }

      // high altitude reminder
      if(highAltitudeCities.indexOf(city)!==-1){
        // if entering this city for the first time (i.e., prevCity different)
        if(prevCity !== city){
          reminders.push({type:'高反',text:'目的地海拔较高，请关注高原反应并准备必要药物/休息安排'})
        }
      }

      // simple early flight/transfer detection
      if(transportation.detail && /\b(0?\d|1\d|2[0-3]):[0-5]\d\b/.test(transportation.detail)){
        var tmatch = transportation.detail.match(/(\d{1,2}):(\d{2})/)
        if(tmatch){
          var hour = parseInt(tmatch[1],10)
          if(hour>=0 && hour<8){
            reminders.push({type:'值机',text:'存在早班航班/车次，建议提前在线值机并预留足够时间'})
          }
        }
      }

      timeline.push({
        day_number: dayNum,
        date: dateStr,
        day_of_week: dayOfWeek(dateStr),
        current_city: city,
        schedules: schedules,
        accommodation: accommodation,
        transportation: transportation,
        reminders: reminders
      })

      prevCity = city
    })

    return {
      trip_meta: {
        departure: input.departure || '待定',
        total_days: total_days,
        group_size: Number(input.group_size) || 1,
        initial_known_cost: initial_known_cost
      },
      timeline: timeline
    }
  }

  // Expose
  if(typeof module !== 'undefined' && module.exports) module.exports = { generatePlan: generatePlan }
  else root.generatePlan = generatePlan
})(this)
