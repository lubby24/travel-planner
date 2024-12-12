import React, { useState, useRef, useEffect } from 'react';
import { Card, Form, Input, DatePicker, Button, Timeline, Select, List, Tag, Space, Modal, message, Spin } from 'antd';
import { Map, MapApiLoaderHOC, Marker, NavigationControl, ZoomControl } from 'react-bmapgl';
import moment from 'moment';
import { ArrowRightOutlined, ShareAltOutlined, CloseOutlined } from '@ant-design/icons';
import InfiniteScroll from 'react-infinite-scroll-component';

const { Option } = Select;

const TripPlanner = () => {
  const [itinerary, setItinerary] = useState([]);
  const [attractions, setAttractions] = useState([]);
  const [selectedAttractions, setSelectedAttractions] = useState([]);
  const [center, setCenter] = useState({
    lng: 121.4737,
    lat: 31.2304
  });
  
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [form] = Form.useForm();

  // 添加新的状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(null);
  const [availableAttractions, setAvailableAttractions] = useState([]);

  // 添加分享相关状态
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareLink, setShareLink] = useState('');

  // 添加分页相关状态
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    if (window.BMapGL && !map) {
      try {
        const newMap = new window.BMapGL.Map('bmap-container');
        const point = new window.BMapGL.Point(center.lng, center.lat);
        newMap.centerAndZoom(point, 13);
        newMap.enableScrollWheelZoom();
        newMap.enableDragging();
        newMap.enableDoubleClickZoom();
        
        // 添加地图控件
        newMap.addControl(new window.BMapGL.ScaleControl());
        newMap.addControl(new window.BMapGL.ZoomControl());
        newMap.addControl(new window.BMapGL.NavigationControl());
        
        setMap(newMap);
      } catch (error) {
        console.error('Map initialization error:', error);
      }
    }
  }, []);

  // 修改搜索函数
  const handleSearch = (value) => {
    if (!map || !value) return;
    
    setSearchKeyword(value);
    setPageNo(1);
    setAttractions([]);
    setHasMore(true);
    
    // 创建地址解析器实例     
    const myGeo = new window.BMapGL.Geocoder();
    // 将地址解析结果显示在地图上，并调整地图视野    
    myGeo.getPoint(value, function(point){
      if (point) {
        map.centerAndZoom(point, 13);
        setCenter({ lng: point.lng, lat: point.lat });
        searchAttractions(value, 1);
      }
    }, value);
  };

  // 添加景点搜索函数
  const searchAttractions = (keyword, page) => {
    setLoading(true);
    
    // 创建本地搜索实例
    const local = new window.BMapGL.LocalSearch(map, {
      pageCapacity: 20, // 每页结果数
      onSearchComplete: function(results) {
        setLoading(false);
        if (results && results.getCurrentNumPois()) {
          const points = [];
          for (let i = 0; i < results.getCurrentNumPois(); i++) {
            const poi = results.getPoi(i);
            points.push({
              id: `${page}-${i}`, // 使用页码和索引组合作为唯一ID
              name: poi.title,
              address: poi.address || '地址未知',
              location: {
                lng: poi.point.lng,
                lat: poi.point.lat
              },
              rating: poi.rating || "暂无评分",
              type: "景点"
            });
          }
          
          if (page === 1) {
            setAttractions(points);
          } else {
            setAttractions(prev => [...prev, ...points]);
          }
          
          // 检查是否还有更多结果
          setHasMore(results.getNumPages() > page);
        } else {
          setHasMore(false);
          if (page === 1) {
            setAttractions([]);
          }
        }
      }
    });
    
    local.search(keyword + " 景点", {
      pageIndex: page - 1 // 百度地图API的页码从0开始
    });
  };

  // 添加加载更多函数
  const loadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = pageNo + 1;
    setPageNo(nextPage);
    searchAttractions(searchKeyword, nextPage);
  };

  // 检查景点是否已被选中
  const isAttractionSelected = (attraction) => {
    return selectedAttractions.some(item => item.id === attraction.id);
  };

  // 修改选择景点的处理函数
  const handleAttractionSelect = (attraction) => {
    if (!isAttractionSelected(attraction)) {
      setSelectedAttractions([...selectedAttractions, attraction]);
    }
  };

  // 修改路线绘制函数
  const drawRoute = (dayAttractions) => {
    if (!map || dayAttractions.length < 2) return;

    // 清除现有路线
    map.clearOverlays();

    // 为每个景点添加标记和标签
    dayAttractions.forEach((attraction, index) => {
      const point = new window.BMapGL.Point(attraction.location.lng, attraction.location.lat);
      
      // 创建标记
      const marker = new window.BMapGL.Marker(point);
      map.addOverlay(marker);

      // 创建标签
      const label = new window.BMapGL.Label(
        `${index + 1}. ${attraction.name}`, 
        {
          position: point,
          offset: new window.BMapGL.Size(25, 0)
        }
      );
      label.setStyle({
        color: '#fff',
        backgroundColor: index === 0 ? '#52c41a' : 
                        index === dayAttractions.length - 1 ? '#f5222d' : '#1890ff',
        border: 'none',
        padding: '5px 10px',
        borderRadius: '3px',
        fontSize: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
      });
      map.addOverlay(label);

      // 添加点击事件
      marker.addEventListener('click', () => {
        const infoWindow = new window.BMapGL.InfoWindow(`
          <div style="padding: 10px;">
            <h4 style="margin: 0 0 5px 0;">${attraction.name}</h4>
            <p style="margin: 0; color: #666;">${attraction.address}</p>
            ${index < dayAttractions.length - 1 ? `
              <p style="margin: 5px 0 0 0; color: #1890ff;">
                到下一站：${formatDistance(calculateDistance(
                  attraction.location,
                  dayAttractions[index + 1].location
                ))}
              </p>
            ` : ''}
          </div>
        `, {
          width: 250,
          height: 100,
          title: ''
        });
        map.openInfoWindow(infoWindow, point);
      });
    });

    // 创建路线规划数组
    const routePromises = [];
    
    // 为相邻景点创建路线规划
    for (let i = 0; i < dayAttractions.length - 1; i++) {
      const promise = new Promise((resolve) => {
        const driving = new window.BMapGL.DrivingRoute(map, {
          renderOptions: {
            map: map,
            autoViewport: false,
            enableDragging: true,
            // 设置路线样式
            strokeColor: '#1890ff',
            strokeWeight: 6,
            strokeOpacity: 0.8
          },
          onSearchComplete: function(results) {
            if (driving.getStatus() === window.BMAP_STATUS_SUCCESS) {
              resolve();
            }
          }
        });

        const start = dayAttractions[i];
        const end = dayAttractions[i + 1];

        driving.search(
          new window.BMapGL.Point(start.location.lng, start.location.lat),
          new window.BMapGL.Point(end.location.lng, end.location.lat)
        );
      });

      routePromises.push(promise);
    }

    // 等待所有路线规划完成后调整视野
    Promise.all(routePromises).then(() => {
      const points = dayAttractions.map(
        attraction => new window.BMapGL.Point(attraction.location.lng, attraction.location.lat)
      );
      const view = map.getViewport(points);
      map.centerAndZoom(view.center, view.zoom);

      // 添加行程信息面板
      const totalDistance = dayAttractions.reduce((total, curr, index) => {
        if (index === 0) return 0;
        const prev = dayAttractions[index - 1];
        return total + calculateDistance(prev.location, curr.location);
      }, 0);

      const panel = new window.BMapGL.InfoWindow(`
        <div style="padding: 10px;">
          <h4 style="margin: 0 0 10px 0;">行程信息</h4>
          <p style="margin: 5px 0;">总景点数：${dayAttractions.length}个</p>
          <p style="margin: 5px 0;">总距离：${formatDistance(totalDistance)}</p>
        </div>
      `, {
        width: 200,
        height: 100,
        title: ''
      });

      map.openInfoWindow(panel, map.getCenter());
    });
  };

  // 添加计算两点间距离的函数
  const calculateDistance = (point1, point2) => {
    return map.getDistance(
      new window.BMapGL.Point(point1.lng, point1.lat),
      new window.BMapGL.Point(point2.lng, point2.lat)
    );
  };

  // 添加格式化距离的函数
  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}米`;
    }
    return `${(meters / 1000).toFixed(1)}公里`;
  };

  // 修改生成行程函数，添加智能排序
  const handleGenerateItinerary = () => {
    const values = form.getFieldsValue();
    const { dates } = values;
    
    if (!dates || selectedAttractions.length === 0) return;

    const startDate = dates[0];
    const endDate = dates[1];
    const days = endDate.diff(startDate, 'days') + 1;
    
    // 按天组织行程
    const newItinerary = [];
    const attractionsPerDay = Math.ceil(selectedAttractions.length / days);
    
    for (let day = 0; day < days; day++) {
      const currentDate = moment(startDate).add(day, 'days');
      let dayAttractions = selectedAttractions.slice(
        day * attractionsPerDay,
        (day + 1) * attractionsPerDay
      );

      // 智能排序：按照距离最近原则排序
      if (dayAttractions.length > 1) {
        const sortedAttractions = [dayAttractions[0]]; // 从第一个景点开始
        dayAttractions = dayAttractions.slice(1);

        while (dayAttractions.length > 0) {
          const lastPoint = sortedAttractions[sortedAttractions.length - 1];
          let nearestIndex = 0;
          let minDistance = Infinity;

          // 找到距离上一个景点最近的下一个景点
          dayAttractions.forEach((attraction, index) => {
            const distance = calculateDistance(
              lastPoint.location,
              attraction.location
            );
            if (distance < minDistance) {
              minDistance = distance;
              nearestIndex = index;
            }
          });

          sortedAttractions.push(dayAttractions[nearestIndex]);
          dayAttractions.splice(nearestIndex, 1);
        }

        dayAttractions = sortedAttractions;
      }

      // 计算相邻景点间的距离
      const attractionsWithDistance = dayAttractions.map((attraction, index) => {
        let distance = null;
        if (index < dayAttractions.length - 1) {
          distance = calculateDistance(
            attraction.location,
            dayAttractions[index + 1].location
          );
        }
        return { attraction, distance };
      });
      
      const dayPlan = {
        day: day + 1,
        date: currentDate.format('YYYY-MM-DD'),
        attractions: attractionsWithDistance
      };
      
      newItinerary.push(dayPlan);
    }
    
    setItinerary(newItinerary);
  };

  // 添加景点调整函数
  const handleDayAttractionRemove = (dayIndex, attractionIndex) => {
    const newItinerary = [...itinerary];
    const removedAttraction = newItinerary[dayIndex].attractions[attractionIndex].attraction;
    
    // 从当天行程中移除景点
    newItinerary[dayIndex].attractions.splice(attractionIndex, 1);
    
    // 如果该天没有景点了，则移除这一天
    if (newItinerary[dayIndex].attractions.length === 0) {
      newItinerary.splice(dayIndex, 1);
    }
    
    // 更新选中的景点列表
    setSelectedAttractions(selectedAttractions.filter(a => a.id !== removedAttraction.id));
    setItinerary(newItinerary);
  };

  // 添加景点移动函数
  const handleDayAttractionMove = (dayIndex, attractionIndex, direction) => {
    const newItinerary = [...itinerary];
    const dayPlan = newItinerary[dayIndex];
    const { attractions } = dayPlan;
    
    if (direction === 'up' && attractionIndex > 0) {
      // 向上移动
      [attractions[attractionIndex], attractions[attractionIndex - 1]] = 
      [attractions[attractionIndex - 1], attractions[attractionIndex]];
    } else if (direction === 'down' && attractionIndex < attractions.length - 1) {
      // 向下移动
      [attractions[attractionIndex], attractions[attractionIndex + 1]] = 
      [attractions[attractionIndex + 1], attractions[attractionIndex]];
    }
    
    setItinerary(newItinerary);
    // 更新路线
    drawRoute(attractions.map(item => item.attraction));
  };

  // 添加处理函数
  const handleAddAttraction = (dayIndex) => {
    const available = attractions.filter(
      a => !selectedAttractions.some(sa => sa.id === a.id)
    );
    setAvailableAttractions(available);
    setCurrentDayIndex(dayIndex);
    setIsModalVisible(true);
  };

  const handleModalOk = (selectedAttraction) => {
    if (selectedAttraction && currentDayIndex !== null) {
      const newItinerary = [...itinerary];
      const dayPlan = newItinerary[currentDayIndex];
      
      // 添加新景点到当天行程
      dayPlan.attractions.push({
        time: `下午 ${14 + dayPlan.attractions.length * 2}:00`,
        attraction: selectedAttraction
      });
      
      // 更新选中的景点列表
      setSelectedAttractions([...selectedAttractions, selectedAttraction]);
      setItinerary(newItinerary);
    }
    setIsModalVisible(false);
  };

  // 修改模态框组件为右侧面板
  const AddAttractionModal = () => {
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // 修改搜索地址函数
    const handleAddressSearch = (value) => {
      if (!value || !map) return;
      setSearching(true);

      // 清除之前的标记
      map.clearOverlays();

      const local = new window.BMapGL.LocalSearch(map, {
        pageCapacity: 10,
        onMarkersSet: function(pois) {
          // 当标记被设置时，调整地图视野
          if (pois && pois.length > 0) {
            // 收集所有点的坐标
            const points = pois.map(poi => poi.marker.getPosition());
            
            // 计算最佳视野
            const viewPort = map.getViewport(points, {
              margins: [50, 50, 50, 50] // 设置边距，使视野更合适
            });
            
            // 平滑地调整地图视野
            map.animateViewport({
              center: viewPort.center,
              zoom: viewPort.zoom,
              tilt: 0,
              heading: 0,
              duration: 1000 // 动画持续时间
            });
          }
        },
        onSearchComplete: function(results) {
          setSearching(false);
          if (results && results.getCurrentNumPois()) {
            const points = [];
            for (let i = 0; i < results.getCurrentNumPois(); i++) {
              const poi = results.getPoi(i);
              points.push({
                id: `custom-${Date.now()}-${i}`,
                name: poi.title,
                address: poi.address || '地址未知',
                location: {
                  lng: poi.point.lng,
                  lat: poi.point.lat
                },
                type: poi.type || "地点"
              });

              // 为每个结果添加标记和信息窗口
              const marker = new window.BMapGL.Marker(poi.point, {
                enableAnimation: true // 启用动画效果
              });
              
              // 添加跳动动画
              marker.setAnimation(window.BMAP_ANIMATION_BOUNCE);
              setTimeout(() => {
                marker.setAnimation(null);
              }, 2000); // 2秒后停止跳动

              const label = new window.BMapGL.Label(`${i + 1}. ${poi.title}`, {
                position: poi.point,
                offset: new window.BMapGL.Size(25, 0)
              });
              label.setStyle({
                color: '#fff',
                backgroundColor: '#1890ff',
                border: 'none',
                padding: '5px 10px',
                borderRadius: '3px',
                fontSize: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                zIndex: 100
              });

              // 添加鼠标悬停效果
              marker.addEventListener('mouseover', () => {
                label.setStyle({
                  backgroundColor: '#096dd9',
                  transform: 'scale(1.05)'
                });
              });
              
              marker.addEventListener('mouseout', () => {
                label.setStyle({
                  backgroundColor: '#1890ff',
                  transform: 'scale(1)'
                });
              });

              // 添加点击事件
              marker.addEventListener('click', () => {
                const infoWindow = new window.BMapGL.InfoWindow(`
                  <div style="padding: 10px;">
                    <h4 style="margin: 0 0 5px 0;">${poi.title}</h4>
                    <p style="margin: 0; color: #666;">${poi.address || '地址未知'}</p>
                    ${poi.type ? `<p style="margin: 5px 0 0 0; color: #1890ff;">类型：${poi.type}</p>` : ''}
                    <div style="margin-top: 10px;">
                      <button onclick="document.querySelector('[data-poi-id=\\"${i}\\"]').click()" 
                              style="background: #1890ff; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                        添加到行程
                      </button>
                    </div>
                  </div>
                `, {
                  width: 300,
                  height: 120,
                  title: '',
                  enableAnimation: true // 启用信息窗口动画
                });
                map.openInfoWindow(infoWindow, poi.point);
              });

              map.addOverlay(marker);
              map.addOverlay(label);
            }
            setSearchResults(points);
          } else {
            setSearchResults([]);
          }
        }
      });

      local.search(value);
    };

    return (
      <div
        style={{
          position: 'fixed',
          right: isModalVisible ? 0 : '-400px',
          top: 0,
          width: '400px',
          height: '100vh',
          background: '#fff',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
          transition: 'right 0.3s',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0 }}>添加地址</h3>
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => {
              setIsModalVisible(false);
              setSearchResults([]);
              setSearchValue('');
            }}
          />
        </div>

        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <Input.Search
            placeholder="搜索地址（如：车站、机场、酒店等）"
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            onSearch={handleAddressSearch}
            enterButton
            loading={searching}
            style={{ marginBottom: 16 }}
          />
          <div style={{ color: '#666', fontSize: '12px' }}>
            支持搜索：车站、机场、酒店、景点、餐厅等任意地点
          </div>
        </div>

        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          padding: '16px',
          backgroundColor: '#f5f5f5'
        }}>
          <List
            size="small"
            dataSource={searchResults}
            loading={searching}
            locale={{ emptyText: searchValue ? '未找到相关地址' : '请输入地址关键词' }}
            renderItem={(item, index) => (
              <List.Item
                data-poi-id={index}
                style={{
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  backgroundColor: '#fff',
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
                onClick={() => {
                  handleModalOk(item);
                  setSearchValue('');
                  setSearchResults([]);
                  setIsModalVisible(false);
                  // 点击列表项时，在地图上显示该位置
                  const point = new window.BMapGL.Point(item.location.lng, item.location.lat);
                  map.centerAndZoom(point, 15);
                }}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {item.name}
                      <Tag color="blue">{item.type}</Tag>
                    </Space>
                  }
                  description={
                    <div style={{ color: '#666', fontSize: '12px' }}>
                      <Space>
                        <span>📍 {item.address}</span>
                      </Space>
                    </div>
                  }
                />
                <Button type="primary" size="small">添加</Button>
              </List.Item>
            )}
          />
        </div>
      </div>
    );
  };

  // 添加导航函数
  const handleNavigate = (from, to) => {
    if (!map || !from || !to) return;

    // 清除现有路线
    map.clearOverlays();

    // 添加起点和终点标记
    const startMarker = new window.BMapGL.Marker(
      new window.BMapGL.Point(from.lng, from.lat)
    );
    const endMarker = new window.BMapGL.Marker(
      new window.BMapGL.Point(to.lng, to.lat)
    );
    map.addOverlay(startMarker);
    map.addOverlay(endMarker);

    // 创建驾车路线规划
    const driving = new window.BMapGL.DrivingRoute(map, {
      renderOptions: {
        map: map,
        autoViewport: true,
        enableDragging: true
      }
    });

    // 规划路线
    driving.search(
      new window.BMapGL.Point(from.lng, from.lat),
      new window.BMapGL.Point(to.lng, to.lat)
    );
  };

  // 生成分享链接
  const generateShareLink = () => {
    const shareData = {
      itinerary,
      selectedAttractions
    };
    
    // 将行程数据编码为 URL 参数
    const encodedData = encodeURIComponent(JSON.stringify(shareData));
    const link = `${window.location.origin}${window.location.pathname}?plan=${encodedData}`;
    setShareLink(link);
    setShareModalVisible(true);
  };

  // 复制链接到剪贴板
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        message.success('链接已复制到剪贴板');
      })
      .catch(() => {
        message.error('复制失败，请手动复制');
      });
  };

  // 从 URL 加载分享的行程
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPlan = urlParams.get('plan');
    
    if (sharedPlan) {
      try {
        const decodedData = JSON.parse(decodeURIComponent(sharedPlan));
        setItinerary(decodedData.itinerary);
        setSelectedAttractions(decodedData.selectedAttractions);
      } catch (error) {
        console.error('Failed to load shared plan:', error);
        message.error('加载分享的行程失败');
      }
    }
  }, []);

  // 添加分享模态框组件
  const ShareModal = () => (
    <Modal
      title="分享行程"
      open={shareModalVisible}
      onCancel={() => setShareModalVisible(false)}
      footer={[
        <Button key="copy" type="primary" onClick={copyToClipboard}>
          复制链接
        </Button>,
        <Button key="close" onClick={() => setShareModalVisible(false)}>
          关闭
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <p>复制以下链接分享给好友：</p>
        <Input.TextArea
          value={shareLink}
          autoSize={{ minRows: 3, maxRows: 5 }}
          readOnly
        />
      </div>
      <div style={{ color: '#666', fontSize: '12px' }}>
        <p>提示：打开链接即可查看完整行程安排</p>
      </div>
    </Modal>
  );

  // 修改行程展示部分，添加分享按钮
  const renderItinerary = () => {
    if (itinerary.length === 0) return null;

    return (
      <Card 
        title="行程安排" 
        bordered={false}
        extra={
          <Button 
            type="primary" 
            icon={<ShareAltOutlined />}
            onClick={generateShareLink}
          >
            分享行程
          </Button>
        }
        bodyStyle={{ 
          maxHeight: 'calc(100vh - 100px)',
          overflow: 'auto',
          padding: '16px'
        }}
      >
        <Timeline>
          {itinerary.map((dayPlan, dayIndex) => (
            <Timeline.Item 
              key={dayIndex}
              dot={
                <div 
                  style={{
                    background: '#1890ff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    lineHeight: '16px',
                    textAlign: 'center',
                    color: 'white',
                    fontSize: '12px'
                  }}
                >
                  {dayPlan.day}
                </div>
              }
            >
              <Card 
                size="small" 
                title={`第${dayPlan.day}天 (${dayPlan.date})`}
                extra={
                  <Space>
                    <Button 
                      type="link" 
                      onClick={() => drawRoute(dayPlan.attractions.map(item => item.attraction))}
                    >
                      查看路线
                    </Button>
                    <Button 
                      type="link"
                      onClick={() => handleAddAttraction(dayIndex)}
                    >
                      添加地址
                    </Button>
                  </Space>
                }
              >
                <Timeline>
                  {dayPlan.attractions.map((item, index) => (
                    <Timeline.Item 
                      key={index}
                      color={index === 0 ? 'green' : index === dayPlan.attractions.length - 1 ? 'red' : 'blue'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space direction="vertical" size={0}>
                          <Space>
                            <span>{item.attraction.name}</span>
                            <span style={{ color: '#999', fontSize: '12px' }}>
                              {item.attraction.address}
                            </span>
                          </Space>
                          {item.distance && (
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, height: 'auto' }}
                              onClick={() => handleNavigate(
                                item.attraction.location,
                                dayPlan.attractions[index + 1].attraction.location
                              )}
                            >
                              <span style={{ color: '#1890ff', fontSize: '12px' }}>
                                到下一景点距离: {formatDistance(item.distance)}
                                <ArrowRightOutlined style={{ marginLeft: '4px' }} />
                              </span>
                            </Button>
                          )}
                        </Space>
                        <Space>
                          <Button 
                            type="text" 
                            size="small"
                            onClick={() => handleDayAttractionMove(dayIndex, index, 'up')}
                            disabled={index === 0}
                          >
                            ↑
                          </Button>
                          <Button 
                            type="text" 
                            size="small"
                            onClick={() => handleDayAttractionMove(dayIndex, index, 'down')}
                            disabled={index === dayPlan.attractions.length - 1}
                          >
                            ↓
                          </Button>
                          <Button 
                            type="text" 
                            danger 
                            size="small"
                            onClick={() => handleDayAttractionRemove(dayIndex, index)}
                          >
                            删除
                          </Button>
                        </Space>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            </Timeline.Item>
          ))}
        </Timeline>
        <AddAttractionModal />
        <ShareModal />
      </Card>
    );
  };

  return (
    <div style={{ padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* 左侧区域：搜索和景点列表 */}
        <div style={{ width: '30%' }}>
          <Card title="行程信息" bordered={false}>
            <Form 
              form={form}
              onFinish={handleGenerateItinerary}
              initialValues={{
                destination: '',
                dates: null
              }}
            >
              <Form.Item 
                label="目的地" 
                name="destination"
                rules={[{ required: true, message: '请输入目的地' }]}
              >
                <Input.Search
                  placeholder="输入目的地"
                  onSearch={handleSearch}
                  enterButton
                />
              </Form.Item>
              <Form.Item 
                label="出行日期" 
                name="dates"
                rules={[{ required: true, message: '请选择出行日期' }]}
              >
                <DatePicker.RangePicker 
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item label="已选景点">
                {selectedAttractions.map(attraction => (
                  <Tag 
                    key={attraction.id}
                    closable
                    onClose={() => setSelectedAttractions(
                      selectedAttractions.filter(a => a.id !== attraction.id)
                    )}
                  >
                    {attraction.name}
                  </Tag>
                ))}
              </Form.Item>
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  block
                  disabled={selectedAttractions.length === 0}
                  onClick={() => {
                    form.validateFields()
                      .then(handleGenerateItinerary)
                      .catch(console.error);
                  }}
                >
                  生成行程
                </Button>
              </Form.Item>
            </Form>
          </Card>
          
          {attractions.length > 0 && (
            <Card 
              title={
                <Space>
                  推荐景点
                  <Tag color="blue">{attractions.length}个</Tag>
                </Space>
              } 
              style={{ marginTop: '20px' }}
              bordered={false}
            >
              <div
                id="scrollableDiv"
                style={{
                  height: 'calc(100vh - 500px)', // 动态计算高度
                  overflow: 'auto',
                  padding: '0 16px',
                  border: '1px solid rgba(140, 140, 140, 0.35)',
                  borderRadius: '8px',
                  backgroundColor: '#fff'
                }}
              >
                <InfiniteScroll
                  dataLength={attractions.length}
                  next={loadMore}
                  hasMore={hasMore}
                  loader={
                    <div style={{ textAlign: 'center', padding: '12px' }}>
                      <Spin tip="加载中..." />
                    </div>
                  }
                  endMessage={
                    <div style={{ textAlign: 'center', padding: '12px', color: '#999' }}>
                      没有更多景点了
                    </div>
                  }
                  scrollableTarget="scrollableDiv"
                >
                  <List
                    size="small"
                    dataSource={attractions}
                    renderItem={item => {
                      const selected = isAttractionSelected(item);
                      return (
                        <List.Item
                          style={{
                            background: selected ? '#f0f8ff' : 'transparent',
                            opacity: selected ? 0.7 : 1,
                            padding: '12px',
                            borderRadius: '4px',
                            marginBottom: '8px',
                            border: '1px solid #f0f0f0',
                            transition: 'all 0.3s'
                          }}
                          actions={[
                            <Button 
                              type={selected ? "text" : "primary"}
                              size="small"
                              onClick={() => handleAttractionSelect(item)}
                              disabled={selected}
                            >
                              {selected ? '已添加' : '添加到行程'}
                            </Button>
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <Space>
                                {item.name}
                                {selected && (
                                  <Tag color="success">已选</Tag>
                                )}
                                {item.rating && item.rating !== "暂无评分" && (
                                  <Tag color="orange">{item.rating}分</Tag>
                                )}
                              </Space>
                            }
                            description={
                              <div style={{ color: '#666', fontSize: '12px' }}>
                                <Space>
                                  <span>📍 {item.address}</span>
                                  {item.type && <Tag size="small">{item.type}</Tag>}
                                </Space>
                              </div>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                </InfiniteScroll>
              </div>
            </Card>
          )}
        </div>

        {/* 中间区域：地图 */}
        <div style={{ width: '40%' }}>
          <Card 
            title="地图路线" 
            style={{ marginBottom: '20px' }}
            bordered={false}
          >
            <div 
              id="bmap-container" 
              style={{ 
                height: 'calc(100vh - 100px)',
                width: '100%',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            />
          </Card>
        </div>

        {/* 右侧区域：行程安排 */}
        <div style={{ width: '30%' }}>
          {itinerary.length > 0 ? (
            <Card 
              title="行程安排" 
              bordered={false}
              extra={
                <Button 
                  type="primary" 
                  icon={<ShareAltOutlined />}
                  onClick={generateShareLink}
                >
                  分享行程
                </Button>
              }
              bodyStyle={{ 
                maxHeight: 'calc(100vh - 100px)',
                overflow: 'auto',
                padding: '16px'
              }}
            >
              <Timeline>
                {itinerary.map((dayPlan, dayIndex) => (
                  <Timeline.Item 
                    key={dayIndex}
                    dot={
                      <div 
                        style={{
                          background: '#1890ff',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          lineHeight: '16px',
                          textAlign: 'center',
                          color: 'white',
                          fontSize: '12px'
                        }}
                      >
                        {dayPlan.day}
                      </div>
                    }
                  >
                    <Card 
                      size="small" 
                      title={`第${dayPlan.day}天 (${dayPlan.date})`}
                      extra={
                        <Space>
                          <Button 
                            type="link" 
                            onClick={() => drawRoute(dayPlan.attractions.map(item => item.attraction))}
                          >
                            查看路线
                          </Button>
                          <Button 
                            type="link"
                            onClick={() => handleAddAttraction(dayIndex)}
                          >
                            添加地址
                          </Button>
                        </Space>
                      }
                    >
                      <Timeline>
                        {dayPlan.attractions.map((item, index) => (
                          <Timeline.Item 
                            key={index}
                            color={index === 0 ? 'green' : index === dayPlan.attractions.length - 1 ? 'red' : 'blue'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Space direction="vertical" size={0}>
                                <Space>
                                  <span>{item.attraction.name}</span>
                                  <span style={{ color: '#999', fontSize: '12px' }}>
                                    {item.attraction.address}
                                  </span>
                                </Space>
                                {item.distance && (
                                  <Button
                                    type="link"
                                    size="small"
                                    style={{ padding: 0, height: 'auto' }}
                                    onClick={() => handleNavigate(
                                      item.attraction.location,
                                      dayPlan.attractions[index + 1].attraction.location
                                    )}
                                  >
                                    <span style={{ color: '#1890ff', fontSize: '12px' }}>
                                      到下一景点距离: {formatDistance(item.distance)}
                                      <ArrowRightOutlined style={{ marginLeft: '4px' }} />
                                    </span>
                                  </Button>
                                )}
                              </Space>
                              <Space>
                                <Button 
                                  type="text" 
                                  size="small"
                                  onClick={() => handleDayAttractionMove(dayIndex, index, 'up')}
                                  disabled={index === 0}
                                >
                                  ↑
                                </Button>
                                <Button 
                                  type="text" 
                                  size="small"
                                  onClick={() => handleDayAttractionMove(dayIndex, index, 'down')}
                                  disabled={index === dayPlan.attractions.length - 1}
                                >
                                  ↓
                                </Button>
                                <Button 
                                  type="text" 
                                  danger 
                                  size="small"
                                  onClick={() => handleDayAttractionRemove(dayIndex, index)}
                                >
                                  删除
                                </Button>
                              </Space>
                            </div>
                          </Timeline.Item>
                        ))}
                      </Timeline>
                    </Card>
                  </Timeline.Item>
                ))}
              </Timeline>
              <AddAttractionModal />
              <ShareModal />
            </Card>
          ) : (
            <Card 
              bordered={false}
              style={{ textAlign: 'center', padding: '40px 0' }}
            >
              <div style={{ color: '#999', marginBottom: '16px' }}>
                请选择景点并生成行程
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TripPlanner; 