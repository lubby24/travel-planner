import React, { useState, useRef, useEffect } from 'react';
import { Card, Form, Input, DatePicker, Button, Timeline, Select, List, Tag, Space, Modal, message, Spin, Tabs, Radio, Dropdown } from 'antd';
import { Map, MapApiLoaderHOC, Marker, NavigationControl, ZoomControl } from 'react-bmapgl';
import moment from 'moment';
import { ArrowRightOutlined, ShareAltOutlined, CloseOutlined, DownloadOutlined, DownOutlined, CarOutlined } from '@ant-design/icons';
import InfiniteScroll from 'react-infinite-scroll-component';
import html2canvas from 'html2canvas';

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

  // 添加预览状态
  const [previewImage, setPreviewImage] = useState(null);

  // 添加新的状态来管理高亮的景点
  const [highlightedAttraction, setHighlightedAttraction] = useState(null);
  const [dragOverDayIndex, setDragOverDayIndex] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null); // 'before' 或 'after'

  // 添加新的状态
  const [hasShownDragTip, setHasShownDragTip] = useState(false);

  // 在 TripPlanner 组件内添加新的状态
  const [transportModalVisible, setTransportModalVisible] = useState(false);

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

  // 修改生成行程函数
  const handleGenerateItinerary = () => {
    const values = form.getFieldsValue();
    const { dates } = values;
    
    if (!dates || selectedAttractions.length === 0) {
      message.warning('请选择出行日期和景点');
      return;
    }

    const startDate = dates[0];
    const endDate = dates[1];
    const days = endDate.diff(startDate, 'days') + 1;
    
    // 创建空的行程数组
    const newItinerary = Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      date: moment(startDate).add(index, 'days').format('YYYY-MM-DD'),
      attractions: []
    }));
    
    setItinerary(newItinerary);

    // 只在第一次生成行程时显示提示
    if (!hasShownDragTip) {
      message.success('请将景点拖拽到对应日期进行安排');
      setHasShownDragTip(true);
    }
  };

  // 在组件重置或清空时重置提示状态
  const handleReset = () => {
    setItinerary([]);
    setSelectedAttractions([]);
    setHasShownDragTip(false);
    form.resetFields();
  };

  // 添加景点到特定日期的函数
  const handleAddToDay = (attraction, dayIndex) => {
    const newItinerary = [...itinerary];
    const dayPlan = newItinerary[dayIndex];
    
    // 检查景点是否已经在任何日期中
    const isAlreadyArranged = itinerary.some(day => 
      day.attractions.some(item => item.attraction.id === attraction.id)
    );
    
    if (isAlreadyArranged) {
      message.warning('该景点已经安排在行程中');
      return;
    }
    
    // 添加景点到当天行程
    dayPlan.attractions.push({
      attraction,
      distance: null,
      arranged: true
    });
    
    // 重新计算该天所有景点之间的距离
    recalculateDistances(dayPlan);
    
    setItinerary(newItinerary);
    // 更新地图路线
    drawRoute(dayPlan.attractions.map(item => item.attraction));
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

  // 修改处理函数
  const handleAddAttraction = (dayIndex, type = 'place') => {
    setCurrentDayIndex(dayIndex);
    if (type === 'transport') {
      setTransportModalVisible(true);
    } else {
      setIsModalVisible(true);
    }
  };

  const handleModalOk = (selectedAttraction) => {
    if (selectedAttraction && currentDayIndex !== null) {
      handleAddToDay(selectedAttraction, currentDayIndex);
    }
    setIsModalVisible(false);
  };

  // 修改处理交通信息的函数
  const handleTransportModalOk = (transportInfo) => {
    if (transportInfo && currentDayIndex !== null) {
      const newItinerary = [...itinerary];
      const dayPlan = newItinerary[currentDayIndex];
      
      // 将 moment 对象转换为 ISO 字符串存储
      const processedTransportInfo = {
        ...transportInfo,
        departureTime: transportInfo.departureTime.toISOString(),
        arrivalTime: transportInfo.arrivalTime.toISOString(),
        duration: transportInfo.duration
      };
      
      dayPlan.attractions.push({
        attraction: {
          id: `transport-${Date.now()}`,
          name: `${transportInfo.type} ${transportInfo.number}`,
          type: 'transport',
          transportInfo: processedTransportInfo,
          location: {
            lng: 0,
            lat: 0
          }
        },
        distance: null,
        arranged: true
      });
      
      setItinerary(newItinerary);
    }
    setTransportModalVisible(false);
  };

  // 添加交通信息模态框组件
  const TransportModal = () => {
    const [form] = Form.useForm();
    const [transportType, setTransportType] = useState('flight');

    const handleSubmit = () => {
      form.validateFields().then(values => {
        const transportInfo = {
          ...values,
          type: transportType === 'flight' ? '航班' : '列车',
          departureTime: values.departureTime,
          arrivalTime: values.arrivalTime,
          duration: values.arrivalTime.diff(values.departureTime, 'minutes')
        };
        
        handleTransportModalOk(transportInfo);
        form.resetFields();
      });
    };

    return (
      <Modal
        title="添加交通信息"
        open={transportModalVisible}
        onCancel={() => {
          setTransportModalVisible(false);
          form.resetFields();
        }}
        onOk={handleSubmit}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <div style={{ marginBottom: 24 }}>
            <Radio.Group 
              value={transportType}
              onChange={e => setTransportType(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="flight">航班</Radio.Button>
              <Radio.Button value="train">列车</Radio.Button>
            </Radio.Group>
          </div>

          <Form.Item
            label={transportType === 'flight' ? "航班号" : "车次"}
            name="number"
            rules={[{ required: true, message: '请输入编号' }]}
          >
            <Input placeholder={transportType === 'flight' ? "如：MU2501" : "如：G1234"} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="出发地"
              name="departurePlace"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请输入出发地' }]}
            >
              <Input placeholder={transportType === 'flight' ? "如：虹桥机场T2" : "如：上海虹桥站"} />
            </Form.Item>

            <Form.Item
              label="到达地"
              name="arrivalPlace"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请输入到达地' }]}
            >
              <Input placeholder={transportType === 'flight' ? "如：首都机场T2" : "如：北京南站"} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item
              label="出发时间"
              name="departureTime"
              style={{ flex: 1 }}
              rules={[{ required: true, message: '请选择出发时间' }]}
            >
              <DatePicker 
                showTime={{ 
                  format: 'HH:mm',
                  defaultValue: moment('00:00', 'HH:mm')
                }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
                disabledDate={(current) => {
                  return current && current < moment().startOf('day');
                }}
              />
            </Form.Item>

            <Form.Item
              label="到达时间"
              name="arrivalTime"
              style={{ flex: 1 }}
              rules={[
                { required: true, message: '请选择到达时间' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const departureTime = getFieldValue('departureTime');
                    if (!value || !departureTime) {
                      return Promise.resolve();
                    }
                    // 使用 unix 时间戳进行比较，确保考虑到日期和时间
                    if (value.unix() <= departureTime.unix()) {
                      return Promise.reject(new Error('到达时间必须晚于出发时间'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker 
                showTime={{ 
                  format: 'HH:mm',
                  defaultValue: moment('00:00', 'HH:mm')
                }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
                disabledDate={(current) => {
                  if (!current) return false;
                  // 只禁用早于今天的日期
                  return current < moment().startOf('day');
                }}
                // 添加 onChange 处理
                onChange={(value) => {
                  // 当选择新的到达时间时，重新触发表单验证
                  form.validateFields(['arrivalTime'])
                    .catch(() => {});
                }}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="备注"
            name="notes"
          >
            <Input.TextArea placeholder="添加备注信息（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    );
  };

  // 修改模态框组件，添加地址搜索功能
  const AddAttractionModal = () => {
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedPoint, setSelectedPoint] = useState(null);

    // 修改地址搜索函数，添加地图标记处理
    const handleAddressSearch = (value) => {
      if (!value || !map) return;
      setSearching(true);
      setSelectedPoint(null); // 重置选中状态

      // 清除现有标记
      map.clearOverlays();

      const local = new window.BMapGL.LocalSearch(map, {
        pageCapacity: 10,
        onSearchComplete: function(results) {
          setSearching(false);
          if (results && results.getCurrentNumPois()) {
            const points = [];
            for (let i = 0; i < results.getCurrentNumPois(); i++) {
              const poi = results.getPoi(i);
              const point = {
                id: `custom-${Date.now()}-${i}`,
                name: poi.title,
                address: poi.address || '地址未知',
                location: {
                  lng: poi.point.lng,
                  lat: poi.point.lat
                },
                type: poi.type || "地点"
              };
              points.push(point);

              // 为每个结果添加标记
              const marker = new window.BMapGL.Marker(poi.point);
              const label = new window.BMapGL.Label(`${i + 1}. ${poi.title}`, {
                position: poi.point,
                offset: new window.BMapGL.Size(20, -20)
              });
              
              // 添加点击事件
              marker.addEventListener('click', () => {
                showPointInfo(point);
              });

              map.addOverlay(marker);
              map.addOverlay(label);
            }
            setSearchResults(points);
            
            // 调整地图视野
            const viewPoints = points.map(p => new window.BMapGL.Point(p.location.lng, p.location.lat));
            map.setViewport(viewPoints);
          } else {
            setSearchResults([]);
          }
        }
      });

      local.search(value);
    };

    // 添加显示地点信息的函数
    const showPointInfo = (point) => {
      setSelectedPoint(point);
      
      // 创建信息窗口
      const infoWindow = new window.BMapGL.InfoWindow(`
        <div style="padding: 10px;">
          <h4 style="margin: 0 0 5px 0;">${point.name}</h4>
          <p style="margin: 0; color: #666;">${point.address}</p>
          ${point.type ? `<p style="margin: 5px 0 0 0; color: #1890ff;">类型：${point.type}</p>` : ''}
        </div>
      `, {
        width: 300,
        height: 120,
        title: '',
        enableAnimation: true
      });

      map.openInfoWindow(infoWindow, new window.BMapGL.Point(point.location.lng, point.location.lat));
    };

    // 添加点击外部关闭的处理函数
    useEffect(() => {
      const handleClickOutside = (event) => {
        const modalElement = document.getElementById('add-attraction-modal');
        const isClickOutside = modalElement && !modalElement.contains(event.target);
        
        if (isModalVisible && isClickOutside) {
          setIsModalVisible(false);
          setSearchResults([]);
          setSearchValue('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isModalVisible]);

    return (
      <div
        id="add-attraction-modal"
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
          />
          <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
            支持搜索：车站、机场、酒店、景点、餐厅等任意地点
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <List
            itemLayout="horizontal"
            dataSource={searchResults}
            loading={searching}
            renderItem={item => (
              <List.Item
                style={{
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  backgroundColor: selectedPoint?.id === item.id ? '#e6f7ff' : '#fff',
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
                onClick={() => showPointInfo(item)}
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
                <Button 
                  type="primary" 
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleModalOk(item);
                    setSearchValue('');
                    setSearchResults([]);
                    setSelectedPoint(null);
                    setIsModalVisible(false);
                  }}
                >
                  添加到行程
                </Button>
              </List.Item>
            )}
            locale={{
              emptyText: searchValue ? '未找到相关地址' : '请输入地址关键词'
            }}
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

    // 创建驾车线规划
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

  // 添加生成图片的函数
  const generateImage = async () => {
    const values = form.getFieldsValue();
    const { destination, dates } = values;
    
    // 创建预览元素
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.background = '#fff';
    element.style.width = '800px';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    
    // 添加标题和行程信息
    const header = document.createElement('div');
    header.style.marginBottom = '20px';
    header.style.borderBottom = '2px solid #1890ff';
    header.style.paddingBottom = '10px';
    header.innerHTML = `
      <div style="margin-top: 12px; color: #333;">
        <div style="font-size: 20px; font-weight: 500;">
          ${destination} 旅行计划
        </div>
        <div style="font-size: 14px; color: #666; margin-top: 8px;">
          出行时间：${dates[0].format('YYYY年MM月DD日')} - ${dates[1].format('YYYY年MM月DD日')}
          （共 ${dates[1].diff(dates[0], 'days') + 1} 天）
        </div>
      </div>
    `;
    element.appendChild(header);

    // 添加行程内容
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="font-size: 16px; margin-bottom: 20px;">
        ${itinerary.map((dayPlan, index) => `
          <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; color: #1890ff; margin-bottom: 10px;">
              第${dayPlan.day}天 (${dayPlan.date})
            </div>
            <div style="padding-left: 20px;">
              ${dayPlan.attractions.map((item, idx) => `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="width: 20px; height: 20px; border-radius: 50%; background: ${
                    idx === 0 ? '#52c41a' : 
                    idx === dayPlan.attractions.length - 1 ? '#f5222d' : 
                    '#1890ff'
                  }; color: white; display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                    ${idx + 1}
                  </span>
                  <div>
                    <div style="font-weight: 500;">${item.attraction.name}</div>
                    <div style="color: #666; font-size: 12px;">${item.attraction.address}</div>
                    ${item.distance ? `
                      <div style="color: #1890ff; font-size: 12px;">
                        到下一站：${formatDistance(item.distance)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    element.appendChild(content);

    // 添加统计信息和水印
    const footer = document.createElement('div');
    footer.style.position = 'relative';
    footer.style.borderTop = '1px solid #f0f0f0';
    footer.style.paddingTop = '12px';
    footer.style.marginTop = '20px';
    footer.innerHTML = `
      <div style="color: #666; font-size: 12px;">
        总景点数：${itinerary.reduce((sum, day) => sum + day.attractions.length, 0)} 个
        &nbsp;|&nbsp;
        生成时间：${moment().format('YYYY-MM-DD HH:mm')}
      </div>
      <div style="position: absolute; right: 0; bottom: 0; color: #bfbfbf; font-size: 12px;">
        由 伴旅 生成
      </div>
    `;
    element.appendChild(footer);

    // 将元素添加到文档中
    document.body.appendChild(element);

    try {
      // 生成图片
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#fff',
        logging: false,
        useCORS: true
      });

      // 转换为图片并下载
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${destination}旅行计划-${moment().format('YYYY-MM-DD')}.png`;
      link.href = image;
      link.click();

      message.success('行程图片已生成');
    } catch (error) {
      console.error('生成图片失败:', error);
      message.error('生成图片失败，请重试');
    } finally {
      // 清理临时元素
      document.body.removeChild(element);
    }
  };

  // 添加生成预览的函数
  const generatePreview = async () => {
    const values = form.getFieldsValue();
    const { destination, dates } = values;
    
    // 创建预览元素
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.background = '#fff';
    element.style.width = '800px';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    
    // 添加标题和行程信息
    const header = document.createElement('div');
    header.style.marginBottom = '20px';
    header.style.borderBottom = '2px solid #1890ff';
    header.style.paddingBottom = '10px';
    header.innerHTML = `
      <div style="margin-top: 12px; color: #333;">
        <div style="font-size: 20px; font-weight: 500;">
          ${destination} 旅行计划
        </div>
        <div style="font-size: 14px; color: #666; margin-top: 8px;">
          出行时间：${dates[0].format('YYYY年MM月DD日')} - ${dates[1].format('YYYY年MM月DD日')}
          （共 ${dates[1].diff(dates[0], 'days') + 1} 天）
        </div>
      </div>
    `;
    element.appendChild(header);

    // 添加行程内容
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="font-size: 16px; margin-bottom: 20px;">
        ${itinerary.map((dayPlan, index) => `
          <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; color: #1890ff; margin-bottom: 10px;">
              第${dayPlan.day}天 (${dayPlan.date})
            </div>
            <div style="padding-left: 20px;">
              ${dayPlan.attractions.map((item, idx) => `
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <span style="width: 20px; height: 20px; border-radius: 50%; background: ${
                    idx === 0 ? '#52c41a' : 
                    idx === dayPlan.attractions.length - 1 ? '#f5222d' : 
                    '#1890ff'
                  }; color: white; display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                    ${idx + 1}
                  </span>
                  <div>
                    <div style="font-weight: 500;">${item.attraction.name}</div>
                    <div style="color: #666; font-size: 12px;">${item.attraction.address}</div>
                    ${item.distance ? `
                      <div style="color: #1890ff; font-size: 12px;">
                        到下一站：${formatDistance(item.distance)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    element.appendChild(content);

    // 添加统计信息和水印
    const footer = document.createElement('div');
    footer.style.position = 'relative';
    footer.style.borderTop = '1px solid #f0f0f0';
    footer.style.paddingTop = '12px';
    footer.style.marginTop = '20px';
    footer.innerHTML = `
      <div style="color: #666; font-size: 12px;">
        总景点数：${itinerary.reduce((sum, day) => sum + day.attractions.length, 0)} 个
        &nbsp;|&nbsp;
        生成时间：${moment().format('YYYY-MM-DD HH:mm')}
      </div>
      <div style="position: absolute; right: 0; bottom: 0; color: #bfbfbf; font-size: 12px;">
        由 伴旅 生成
      </div>
    `;
    element.appendChild(footer);

    // 将元素添加到文档中
    document.body.appendChild(element);

    try {
      // 生成预览图片
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#fff',
        logging: false,
        useCORS: true
      });

      // 设置预览图片
      setPreviewImage(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('生成预览失败:', error);
      message.error('生成预览失败，请重试');
    } finally {
      // 清理临时元素
      document.body.removeChild(element);
    }
  };

  // 在组件挂载时生成预览
  useEffect(() => {
    if (shareModalVisible) {
      generatePreview();
    }
  }, [shareModalVisible]);

  // 修改分享模态框
  const ShareModal = () => (
    <Modal
      title="分享行程"
      open={shareModalVisible}
      onCancel={() => {
        setShareModalVisible(false);
        setPreviewImage(null);  // 清除预览图片
      }}
      footer={null}
      width={500}
    >
      <div style={{ padding: '20px 0' }}>
        <Tabs 
          defaultActiveKey="link" 
          centered
          items={[
            {
              key: 'link',
              label: '链接分享',
              children: (
                <div style={{ padding: '20px 0' }}>
                  <Input.TextArea
                    value={shareLink}
                    autoSize={{ minRows: 3, maxRows: 5 }}
                    readOnly
                    style={{ marginBottom: '16px' }}
                  />
                  <Button 
                    type="primary" 
                    block
                    onClick={copyToClipboard}
                    icon={<ShareAltOutlined />}
                  >
                    复制链接
                  </Button>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                    复制链接发送给好友，即可查看完整行程安排
                  </div>
                </div>
              )
            },
            {
              key: 'image',
              label: '图片分享',
              children: (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <div style={{ marginBottom: '20px' }}>
                    {previewImage ? (
                      <img 
                        src={previewImage}
                        alt="分享预览"
                        style={{ 
                          width: '100%',
                          maxWidth: '400px',
                          borderRadius: '8px',
                          border: '1px solid #f0f0f0',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }} 
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '200px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f5f5f5',
                        borderRadius: '8px'
                      }}>
                        <Spin tip="生成预览中..." />
                      </div>
                    )}
                  </div>
                  <Button 
                    type="primary" 
                    block
                    onClick={generateImage}
                    icon={<DownloadOutlined />}
                  >
                    保存为图片
                  </Button>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
                    生成精美的行程图片，包含完整行程信息
                  </div>
                </div>
              )
            }
          ]} 
        />
      </div>
    </Modal>
  );

  // 在现有的 import 语句下方添加新的函数
  const showAttractionOnMap = (map, attraction) => {
    if (!map || !attraction) return;

    // 清除现有标记
    map.clearOverlays();

    const point = new window.BMapGL.Point(attraction.location.lng, attraction.location.lat);
    
    // 创建标记
    const marker = new window.BMapGL.Marker(point, {
      enableAnimation: true
    });
    map.addOverlay(marker);
    
    // 添加跳动动画
    marker.setAnimation(window.BMAP_ANIMATION_BOUNCE);
    
    // 创建信息窗口
    const infoWindow = new window.BMapGL.InfoWindow(`
      <div style="padding: 10px;">
        <h4 style="margin: 0 0 5px 0;">${attraction.name}</h4>
        <p style="margin: 0; color: #666;">${attraction.address}</p>
      </div>
    `, {
      width: 250,
      height: 80,
      enableAnimation: true
    });

    // 显示信息窗口
    map.openInfoWindow(infoWindow, point);
    
    // 调整地图视野
    map.centerAndZoom(point, 15);
  };

  // 添加拖拽相关的处理函数
  const handleDragStart = (e, attraction) => {
    e.dataTransfer.setData('attraction', JSON.stringify(attraction));
  };

  const handleDragOver = (e, dayIndex) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '#f0f8ff';
    setDragOverDayIndex(dayIndex);
    
    // 计算拖拽位置
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDragOverPosition(y < rect.height / 2 ? 'before' : 'after');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.style.backgroundColor = '';
    setDragOverDayIndex(null);
    setDragOverPosition(null);
  };

  const handleDrop = (e, toDayIndex) => {
    e.preventDefault();
    e.currentTarget.style.backgroundColor = '';
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('attraction'));
      
      // 检查是否是从行程中拖拽的景点
      if (dragData.fromDay !== undefined) {
        // 如果是同一天的拖放，需要处理排序
        if (dragData.fromDay === toDayIndex) {
          handleSameDayReorder(dragData.fromDay, dragData.fromIndex, dragOverPosition);
        } else {
          handleAttractionMove(dragData.fromDay, dragData.fromIndex, toDayIndex);
        }
      } else {
        // 从已选景点列表拖拽的情况
        handleAddToDay(dragData, toDayIndex);
      }
    } catch (error) {
      console.error('Drop error:', error);
    }
    
    // 重置拖放状态
    setDragOverDayIndex(null);
    setDragOverPosition(null);
  };

  // 添加同一天内重新排序的函数
  const handleSameDayReorder = (dayIndex, fromIndex, position) => {
    const newItinerary = [...itinerary];
    const dayPlan = newItinerary[dayIndex];
    const movedAttraction = dayPlan.attractions[fromIndex];
    
    // 从原位置删除
    dayPlan.attractions.splice(fromIndex, 1);
    
    // 计算新的插入位置
    let toIndex = fromIndex;
    if (position === 'before') {
      toIndex = Math.max(0, fromIndex - 1);
    } else if (position === 'after') {
      toIndex = Math.min(dayPlan.attractions.length, fromIndex + 1);
    }
    
    // 插入到新位置
    dayPlan.attractions.splice(toIndex, 0, movedAttraction);
    
    // 重新计算该天所有景点之间的距离
    recalculateDistances(dayPlan);
    
    setItinerary(newItinerary);
    // 更新地图路线
    drawRoute(dayPlan.attractions.map(item => item.attraction));
  };

  // 修改重新计算距离的函数
  const recalculateDistances = (dayPlan) => {
    if (!dayPlan.attractions) return;
    
    dayPlan.attractions.forEach((item, index) => {
      if (index < dayPlan.attractions.length - 1) {
        const nextAttraction = dayPlan.attractions[index + 1];
        item.distance = calculateDistance(
          item.attraction.location,
          nextAttraction.attraction.location
        );
      } else {
        item.distance = null;
      }
    });
  };

  // 添加跨天移动景点的函数
  const handleAttractionMove = (fromDayIndex, fromAttractionIndex, toDayIndex) => {
    const newItinerary = [...itinerary];
    
    // 获取要移动的景点
    const movedAttraction = newItinerary[fromDayIndex].attractions[fromAttractionIndex];
    
    // 从原来的日期中删除
    newItinerary[fromDayIndex].attractions.splice(fromAttractionIndex, 1);
    
    // 添加到新的日期
    newItinerary[toDayIndex].attractions.push(movedAttraction);
    
    // 重新计算两个日期的距离
    recalculateDistances(newItinerary[fromDayIndex]);
    recalculateDistances(newItinerary[toDayIndex]);
    
    // 如果原日期没有景点了，更新地图显示
    if (newItinerary[fromDayIndex].attractions.length > 0) {
      drawRoute(newItinerary[fromDayIndex].attractions.map(item => item.attraction));
    }
    
    // 更新目标日期的地图显示
    drawRoute(newItinerary[toDayIndex].attractions.map(item => item.attraction));
    
    setItinerary(newItinerary);
  };

  // 添加显示景点信息的函数
  const showAttractionInfo = (attraction) => {
    if (!map) return;
    
    // 清除现有标记
    map.clearOverlays();
    
    // 创建标记
    const point = new window.BMapGL.Point(attraction.location.lng, attraction.location.lat);
    const marker = new window.BMapGL.Marker(point);
    map.addOverlay(marker);
    
    // 调整地图视野
    map.setCenter(point);
    map.setZoom(15);
  };

  // 修改行程卡片的额外操作按钮
  const renderCardExtra = (dayIndex, dayPlan) => (
    <Space>
      <Button 
        type="link" 
        onClick={() => drawRoute(dayPlan.attractions.map(item => item.attraction))}
      >
        查看路线
      </Button>
      <Dropdown
        menu={{
          items: [
            {
              key: 'place',
              label: '添加地点',
              onClick: () => handleAddAttraction(dayIndex, 'place')
            },
            {
              key: 'transport',
              label: '添加交通',
              onClick: () => handleAddAttraction(dayIndex, 'transport')
            }
          ]
        }}
      >
        <Button type="link">
          添加 <DownOutlined />
        </Button>
      </Dropdown>
    </Space>
  );

  // 修改渲染行程项的函数
  const renderAttractionItem = (item, index, dayPlan, dayIndex) => {
    const isTransport = item.attraction.type === 'transport';
    const { transportInfo } = item.attraction;

    return (
      <Timeline.Item 
        key={index}
        dot={isTransport ? 
          <CarOutlined style={{ fontSize: '16px' }} /> : 
          null
        }
        color={isTransport ? 'purple' : 
          index === 0 ? 'green' : 
          index === dayPlan.attractions.length - 1 ? 'red' : 
          'blue'
        }
      >
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            cursor: 'move',
            padding: '8px 12px',
            borderRadius: '4px',
            backgroundColor: isTransport ? '#f6f0ff' : 
              (highlightedAttraction === item.attraction.id ? '#e6f7ff' : 'transparent'),
            border: isTransport ? '1px solid #d3adf7' :
              (highlightedAttraction === item.attraction.id ? '1px solid #91d5ff' : '1px solid transparent'),
            transition: 'all 0.3s',
            position: 'relative'
          }}
          draggable
          onDragStart={(e) => {
            const dragData = {
              ...item.attraction,
              fromDay: dayIndex,
              fromIndex: index
            };
            e.dataTransfer.setData('attraction', JSON.stringify(dragData));
            e.currentTarget.style.opacity = '0.5';
          }}
          onDragEnd={(e) => {
            e.currentTarget.style.opacity = '1';
            setDragOverDayIndex(null);
            setDragOverPosition(null);
          }}
          onDragOver={(e) => handleDragOver(e, dayIndex)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => {
            e.stopPropagation();
            handleDrop(e, dayIndex);
          }}
          onMouseEnter={() => setHighlightedAttraction(item.attraction.id)}
          onMouseLeave={() => setHighlightedAttraction(null)}
        >
          {dragOverDayIndex === dayIndex && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#1890ff',
                top: dragOverPosition === 'before' ? 0 : '100%',
                transform: 'translateY(-50%)',
                transition: 'all 0.2s'
              }}
            />
          )}
          
          {isTransport ? (
            <div style={{ flex: 1 }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <Tag color="purple">{transportInfo.type}</Tag>
                  <span style={{ fontWeight: 500 }}>{transportInfo.number}</span>
                </Space>
                <Space style={{ fontSize: '13px', color: '#666' }}>
                  <span>{transportInfo.departurePlace}</span>
                  <ArrowRightOutlined style={{ fontSize: '12px' }} />
                  <span>{transportInfo.arrivalPlace}</span>
                </Space>
                <Space style={{ fontSize: '13px' }}>
                  <span>{moment(transportInfo.departureTime).format('MM-DD HH:mm')}</span>
                  <span style={{ color: '#999' }}>→</span>
                  <span>{moment(transportInfo.arrivalTime).format('MM-DD HH:mm')}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>
                    ({Math.floor(transportInfo.duration / 60)}小时{transportInfo.duration % 60}分钟)
                  </span>
                </Space>
                {transportInfo.notes && (
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    备注：{transportInfo.notes}
                  </div>
                )}
              </Space>
            </div>
          ) : (
            <Space direction="vertical" size={0} style={{ flex: 1 }}>
              <Space>
                <span 
                  style={{ 
                    cursor: 'pointer', 
                    color: '#1890ff',
                    fontWeight: highlightedAttraction === item.attraction.id ? 500 : 'normal'
                  }}
                  onClick={() => {
                    showAttractionInfo(item.attraction);
                    setHighlightedAttraction(item.attraction.id);
                  }}
                >
                  {item.attraction.name}
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
          )}

          <Button 
            type="text" 
            danger 
            size="small"
            onClick={() => handleDayAttractionRemove(dayIndex, index)}
          >
            删除
          </Button>
        </div>
      </Timeline.Item>
    );
  };

  // 修改行程卡片渲染部分
  const renderItinerary = () => {
    if (itinerary.length === 0) return null;

    return (
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
              extra={renderCardExtra(dayIndex, dayPlan)}
              style={{ 
                backgroundColor: dayPlan.attractions.length === 0 ? '#fafafa' : '#fff'
              }}
              bodyStyle={{
                minHeight: '100px'
              }}
              onDragOver={(e) => handleDragOver(e, dayIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, dayIndex)}
            >
              {dayPlan.attractions.length === 0 ? (
                <div 
                  style={{ 
                    height: '100px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: dragOverDayIndex === dayIndex ? 
                      '2px solid #1890ff' : 
                      '2px dashed #d9d9d9',
                    borderRadius: '4px',
                    color: dragOverDayIndex === dayIndex ? '#1890ff' : '#999',
                    backgroundColor: dragOverDayIndex === dayIndex ? 
                      'rgba(24,144,255,0.1)' : 
                      'transparent',
                    transition: 'all 0.3s'
                  }}
                >
                  {dragOverDayIndex === dayIndex ? 
                    '放在这里' : 
                    '将景点拖拽到这里'
                  }
                </div>
              ) : (
                <Timeline>
                  {dayPlan.attractions.map((item, index) => 
                    renderAttractionItem(item, index, dayPlan, dayIndex)
                  )}
                </Timeline>
              )}
            </Card>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  // 在组件返回的 JSX 中使用 renderItinerary
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
                <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                  {selectedAttractions.map(attraction => {
                    const isArranged = itinerary.some(day => 
                      day.attractions.some(item => item.attraction.id === attraction.id)
                    );
                    
                    return (
                      <Tag 
                        key={attraction.id}
                        style={{ 
                          marginBottom: '8px', 
                          cursor: 'move',
                          opacity: isArranged ? 0.5 : 1,
                          backgroundColor: isArranged ? '#f5f5f5' : undefined
                        }}
                        color={isArranged ? 'default' : 'blue'}
                        closable
                        draggable={!isArranged}
                        onDragStart={(e) => handleDragStart(e, attraction)}
                        onClose={() => {
                          // 如果景点已安排，同时从行程中移除
                          if (isArranged) {
                            const newItinerary = itinerary.map(day => ({
                              ...day,
                              attractions: day.attractions.filter(
                                item => item.attraction.id !== attraction.id
                              )
                            }));
                            setItinerary(newItinerary);
                          }
                          setSelectedAttractions(
                            selectedAttractions.filter(a => a.id !== attraction.id)
                          );
                        }}
                      >
                        {attraction.name}
                        {isArranged && <span style={{ marginLeft: '4px', color: '#999' }}>已安排</span>}
                      </Tag>
                    );
                  })}
                </div>
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
                      const selected = selectedAttractions.some(a => a.id === item.id);
                      return (
                        <List.Item
                          style={{
                            cursor: 'pointer',
                            padding: '12px',
                            transition: 'all 0.3s',
                            backgroundColor: highlightedAttraction === item.id ? '#e6f7ff' : '#fff',
                            '&:hover': {
                              backgroundColor: '#f5f5f5'
                            }
                          }}
                          onClick={() => {
                            showAttractionInfo(item);
                            setHighlightedAttraction(item.id);
                          }}
                          onMouseEnter={() => setHighlightedAttraction(item.id)}
                          onMouseLeave={() => setHighlightedAttraction(null)}
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
                          <Space>
                            <Button
                              type="primary"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation(); // 阻止点击事件冒泡
                                if (!selected) {
                                  setSelectedAttractions([...selectedAttractions, item]);
                                  
                                }
                              }}
                              disabled={selected}
                            >
                              {selected ? '已添加' : '添加'}
                            </Button>
                          </Space>
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
              {renderItinerary()}
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
      <AddAttractionModal />
      <TransportModal />
      <ShareModal />
    </div>
  );
};

export default TripPlanner; 