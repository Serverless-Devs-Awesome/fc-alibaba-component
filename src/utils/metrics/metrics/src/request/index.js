import metricDatas from '../mock';
import { Message } from '@alicloud/console-components'
const axios = require('axios');

// const uri = '//localhost:3000';
const uri = '';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const getMetricData = async (params) => {
  try {
    const result = await axios.get(`${uri}/get/metric`, { params });
    if (result.statusText === 'OK' && !result.data.error) {
      return result.data;
    }
    Message.error(`Metric ${params.metric} 请求失败。`);
    return [];
  } catch (e) {
    Message.error(`Metric ${params.metric} 请求失败: `, e.toString());
    return [];
  }
  // await wait(500);
  // return metricDatas[params.metric] || [];
}

const getVersion = async () => {
  const result = await axios.get(`${uri}/get/version`);
  if (result.statusText === 'OK' && !result.data.error) {
    return result.data;
  }
  Message.error(result.data.message);
  return []
}

const getAlias = async () => {
  const result = await axios.get(`${uri}/get/alias`);
  if (result.statusText === 'OK' && !result.data.error) {
    return result.data;
  }
  Message.error(result.data.message);
  return []
}

export {
  getMetricData, getVersion, getAlias
}
